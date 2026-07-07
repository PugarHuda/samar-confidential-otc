// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title PrivateOTC — Samar confidential OTC desk on Zama fhEVM
/// @notice Order size, price and the maker's hidden reserve stay encrypted end to end — from intent
///         creation through atomic settlement. The chain verifies the deal; nobody reads the numbers.
///
/// Direct mode (Live):
///   1. Maker `setOperator(this)` on sellToken, then `createIntent(...)` — sell side is escrowed,
///      `minBuyAmount` is a HIDDEN reserve only the maker can decrypt.
///   2. Maker `grantView(id, taker)` — lets one chosen counterparty decrypt the terms before agreeing.
///   3. Taker `setOperator(this)` on buyToken, then `acceptIntent(id, offer)` — pays and settles atomically.
///
/// Strategy B (privacy on rejection): settlement NEVER reverts on a secret condition (a revert would
/// leak "offer too low"). It always marks Filled and uses FHE.select to route funds — a clearing offer
/// swaps both legs; an offer below the hidden reserve is a no-op that refunds both sides. Escrow nets to zero.
///
/// RFQ mode (Vickrey, second-price sealed bid): bidders escrow encrypted bids; `finalizeAuction` gives the
/// highest bidder the asset and charges them the SECOND-highest price, floored at the maker's encrypted
/// reserve (`minBuyAmount`) — every comparison on encrypted handles, settled per-bidder via FHE.select so no
/// winner identity or bid is ever revealed on-chain. Exactly one winner: a top-tie is broken toward the first
/// such bidder, and if no bid clears the reserve the asset returns to the maker and every bid is refunded.
contract PrivateOTC is ZamaEthereumConfig {
    enum Mode {
        Direct,
        RFQ
    }
    enum Status {
        Open,
        PendingReveal,
        Filled,
        Cancelled,
        Expired
    }

    struct Intent {
        address maker;
        address sellToken; // public
        address buyToken; // public
        euint64 sellAmount; // encrypted — actual escrowed amount
        euint64 minBuyAmount; // encrypted — hidden reserve (Direct)
        Mode mode;
        Status status;
        uint64 expiresAt; // public
        address allowedTaker; // address(0) = open to anyone
    }

    struct Bid {
        address bidder;
        euint64 amount; // encrypted — actual escrowed bid
    }

    // finalizeAuction runs ~16 FHE ops/bidder in one tx. Measured live on Sepolia: 5 bidders finalize
    // (HCU-bound, not gas — 6.2M of the 16.7M gas cap), 6 revert on the coprocessor HCU limit. Since a
    // revert would strand escrowed bids (maker can't cancel once bids exist), the cap MUST stay ≤ 5.
    uint256 public constant MAX_BIDDERS = 5;

    uint256 public nextId;
    mapping(uint256 => Intent) private _intents;
    mapping(uint256 => Bid[]) private _bids;
    mapping(uint256 => mapping(address => bool)) private _hasBid;

    event IntentCreated(
        uint256 indexed id,
        address indexed maker,
        address sellToken,
        address buyToken,
        uint8 mode,
        uint64 expiresAt,
        address allowedTaker
    );
    event ViewGranted(uint256 indexed id, address indexed viewer);
    event IntentAccepted(uint256 indexed id, address indexed taker);
    event IntentCancelled(uint256 indexed id);
    event BidSubmitted(uint256 indexed id, address indexed bidder);
    event AuctionFinalized(uint256 indexed id);

    /// @notice Create an OTC intent. Maker must have `setOperator(address(this), until)` on `sellToken`.
    /// @param encSell encrypted sell amount (handle 0 of the input bundle)
    /// @param encMinBuy encrypted hidden reserve / min buy amount (handle 1 of the same bundle)
    /// @param proof single input proof covering both handles
    function createIntent(
        address sellToken,
        address buyToken,
        externalEuint64 encSell,
        externalEuint64 encMinBuy,
        bytes calldata proof,
        Mode mode,
        uint64 expiresAt,
        address allowedTaker
    ) external returns (uint256 id) {
        require(sellToken != buyToken, "same token");
        require(expiresAt > block.timestamp, "bad expiry");

        euint64 sellAmount = FHE.fromExternal(encSell, proof);
        euint64 minBuyAmount = FHE.fromExternal(encMinBuy, proof);

        // Escrow the sell asset; store the *actual* amount moved.
        FHE.allowTransient(sellAmount, sellToken);
        euint64 escrowed = IERC7984(sellToken).confidentialTransferFrom(msg.sender, address(this), sellAmount);

        FHE.allowThis(escrowed);
        FHE.allowThis(minBuyAmount);
        FHE.allow(escrowed, msg.sender);
        FHE.allow(minBuyAmount, msg.sender);

        id = nextId++;
        _intents[id] = Intent(
            msg.sender,
            sellToken,
            buyToken,
            escrowed,
            minBuyAmount,
            mode,
            Status.Open,
            expiresAt,
            allowedTaker
        );
        emit IntentCreated(id, msg.sender, sellToken, buyToken, uint8(mode), expiresAt, allowedTaker);
    }

    /// @notice Let one counterparty decrypt this intent's encrypted terms before they commit.
    function grantView(uint256 id, address viewer) external {
        Intent storage it = _intents[id];
        require(msg.sender == it.maker, "not maker");
        require(it.status == Status.Open, "not open");
        FHE.allow(it.sellAmount, viewer);
        FHE.allow(it.minBuyAmount, viewer);
        emit ViewGranted(id, viewer);
    }

    /// @notice Accept a Direct intent with an encrypted offer. Taker must `setOperator(this)` on buyToken.
    function acceptIntent(uint256 id, externalEuint64 encOffer, bytes calldata proof) external {
        Intent storage it = _intents[id];
        require(it.status == Status.Open, "not open");
        require(it.mode == Mode.Direct, "not direct");
        require(block.timestamp <= it.expiresAt, "expired");
        require(msg.sender != it.maker, "maker cannot accept");
        if (it.allowedTaker != address(0)) require(msg.sender == it.allowedTaker, "locked");

        euint64 offer = FHE.fromExternal(encOffer, proof);

        // Pull the offer into escrow. Yields the full offer (paid) or 0 (couldn't pay).
        FHE.allowTransient(offer, it.buyToken);
        euint64 paid = IERC7984(it.buyToken).confidentialTransferFrom(msg.sender, address(this), offer);

        // Strategy B — settle iff the paid offer clears the hidden reserve; else no-op refund.
        ebool ok = FHE.ge(paid, it.minBuyAmount);
        euint64 zero = FHE.asEuint64(0);

        euint64 toMaker = FHE.select(ok, paid, zero); // maker receives the offer
        euint64 toTaker = FHE.select(ok, it.sellAmount, zero); // taker receives the asset
        euint64 refundTaker = FHE.select(ok, zero, paid); // else money back to taker
        euint64 refundMaker = FHE.select(ok, zero, it.sellAmount); // else asset back to maker

        it.status = Status.Filled; // ALWAYS Filled — real fill vs no-op stays encrypted

        _payout(it.buyToken, it.maker, toMaker);
        _payout(it.sellToken, msg.sender, toTaker);
        _payout(it.buyToken, msg.sender, refundTaker);
        _payout(it.sellToken, it.maker, refundMaker);

        emit IntentAccepted(id, msg.sender);
    }

    /// @notice Maker reclaims the escrowed asset from an unfilled intent.
    function cancelIntent(uint256 id) external {
        Intent storage it = _intents[id];
        require(msg.sender == it.maker, "not maker");
        require(it.status == Status.Open, "not open");
        require(_bids[id].length == 0, "has bids");
        it.status = Status.Cancelled;
        _payout(it.sellToken, it.maker, it.sellAmount);
        emit IntentCancelled(id);
    }

    // --- RFQ (sealed-bid Vickrey) ---

    /// @notice Submit a sealed encrypted bid to an RFQ intent. Bidder must `setOperator(this)` on the buy token;
    ///         the bid amount is escrowed immediately (returned to losers at finalize).
    function submitBid(uint256 id, externalEuint64 encBid, bytes calldata proof) external {
        Intent storage it = _intents[id];
        require(it.mode == Mode.RFQ, "not rfq");
        require(it.status == Status.Open, "not open");
        require(block.timestamp <= it.expiresAt, "bidding closed");
        require(msg.sender != it.maker, "maker cannot bid");
        if (it.allowedTaker != address(0)) require(msg.sender == it.allowedTaker, "locked");
        require(!_hasBid[id][msg.sender], "already bid");
        require(_bids[id].length < MAX_BIDDERS, "auction full");

        euint64 bid = FHE.fromExternal(encBid, proof);
        FHE.allowTransient(bid, it.buyToken);
        euint64 escrowed = IERC7984(it.buyToken).confidentialTransferFrom(msg.sender, address(this), bid);

        FHE.allowThis(escrowed);
        FHE.allow(escrowed, msg.sender);

        _bids[id].push(Bid(msg.sender, escrowed));
        _hasBid[id][msg.sender] = true;
        emit BidSubmitted(id, msg.sender);
    }

    /// @notice Close an RFQ auction and settle. Maker any time, or anyone after expiry.
    /// @dev Highest bid wins and pays the second-highest price (Vickrey). Winner gets the asset and is refunded
    ///      the overpay; losers are refunded in full; the maker receives the second price. All via FHE.select,
    ///      so the winner and the clearing price are never revealed on-chain.
    function finalizeAuction(uint256 id) external {
        Intent storage it = _intents[id];
        require(it.mode == Mode.RFQ, "not rfq");
        require(it.status == Status.Open, "not open");
        require(msg.sender == it.maker || block.timestamp > it.expiresAt, "not maker / not expired");

        it.status = Status.Filled;
        Bid[] storage bids = _bids[id];

        if (bids.length == 0) {
            _payout(it.sellToken, it.maker, it.sellAmount); // no bids — return escrow
            emit AuctionFinalized(id);
            return;
        }

        // Encrypted first- and second-highest bid.
        euint64 highest = FHE.asEuint64(0);
        euint64 second = FHE.asEuint64(0);
        for (uint256 i = 0; i < bids.length; i++) {
            euint64 cand = bids[i].amount;
            ebool newHigh = FHE.gt(cand, highest);
            second = FHE.select(newHigh, highest, second); // old highest drops to second
            highest = FHE.select(newHigh, cand, highest);
            ebool newSecond = FHE.and(FHE.not(newHigh), FHE.gt(cand, second)); // between second and highest
            second = FHE.select(newSecond, cand, second);
        }

        // Clearing price = second-highest bid, floored at the maker's hidden reserve; a winner exists
        // only if the top bid clears that reserve. All encrypted, so neither leaks on-chain.
        euint64 reserve = it.minBuyAmount;
        ebool sold = FHE.ge(highest, reserve);
        euint64 price = FHE.max(second, reserve);
        euint64 zero = FHE.asEuint64(0);

        // Per-bidder conditional settlement. Exactly one winner: the FIRST bid equal to `highest`
        // (the `awarded` flag breaks ties, so a top-tie never double-pays the asset), and only when sold.
        // The maker's proceeds are ACCUMULATED into one handle and paid ONCE after the loop: paying the
        // clearing price per-row would give the maker N separate transfers (one non-zero), and since the
        // maker can decrypt each of their own legs they could map the non-zero row back to the winner's
        // address (bid order is public via BidSubmitted). A single aggregated transfer hides the winner.
        ebool awarded = FHE.asEbool(false);
        euint64 makerProceeds = zero;
        for (uint256 i = 0; i < bids.length; i++) {
            euint64 bid = bids[i].amount;
            ebool isWinner = FHE.and(FHE.and(FHE.eq(bid, highest), FHE.not(awarded)), sold);
            awarded = FHE.or(awarded, isWinner);

            _payout(it.sellToken, bids[i].bidder, FHE.select(isWinner, it.sellAmount, zero)); // winner gets the asset
            _payout(it.buyToken, bids[i].bidder, FHE.select(isWinner, FHE.sub(bid, price), bid)); // winner overpay back; loser full
            makerProceeds = FHE.add(makerProceeds, FHE.select(isWinner, price, zero)); // clearing price, credited once below
        }

        _payout(it.buyToken, it.maker, makerProceeds); // single transfer — winner row is not observable to the maker
        // No bid cleared the reserve — return the escrowed asset to the maker.
        _payout(it.sellToken, it.maker, FHE.select(sold, zero, it.sellAmount));
        emit AuctionFinalized(id);
    }

    // --- views ---

    function getBidCount(uint256 id) external view returns (uint256) {
        return _bids[id].length;
    }

    function hasBid(uint256 id, address bidder) external view returns (bool) {
        return _hasBid[id][bidder];
    }

    function getIntent(
        uint256 id
    )
        external
        view
        returns (
            address maker,
            address sellToken,
            address buyToken,
            uint8 mode,
            uint8 status,
            uint64 expiresAt,
            address allowedTaker
        )
    {
        Intent storage it = _intents[id];
        return (it.maker, it.sellToken, it.buyToken, uint8(it.mode), uint8(it.status), it.expiresAt, it.allowedTaker);
    }

    /// @notice Encrypted handles; only ACL-permitted addresses (maker, granted viewer) can decrypt.
    function getSellAmount(uint256 id) external view returns (euint64) {
        return _intents[id].sellAmount;
    }

    function getMinBuyAmount(uint256 id) external view returns (euint64) {
        return _intents[id].minBuyAmount;
    }

    // --- internal ---

    function _payout(address token, address to, euint64 amount) private {
        FHE.allowTransient(amount, token);
        IERC7984(token).confidentialTransfer(to, amount);
    }
}
