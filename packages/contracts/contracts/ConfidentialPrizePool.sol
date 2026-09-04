// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialPrizePool — no-loss prize savings (confidential PoolTogether) on Zama fhEVM
/// @notice Users deposit a confidential ERC-7984 token into a shared pool and receive pool shares
///         ("prize tickets") — themselves a transferable ERC-7984. Yield sponsored into the prize
///         reserve is raffled at regular draws. Principal is withdrawable at any time (no loss).
///
/// What stays encrypted, end to end:
///   - every deposit / withdrawal / ticket balance (ERC-7984 euint64 accounting)
///   - every participant's draw weight (encrypted TWAB — time-weighted average balance)
///   - the prize reserve and each tier's prize amount
///   - the winners: selection runs over encrypted cumulative sums and winnings are credited to
///     EVERY participant via FHE.select (winner gets the prize, everyone else gets +0), so not
///     even the contract learns who won. Only a winner sees a nonzero decrypt.
///
/// Deliberate, documented leakage:
///   - the pool's TOTAL draw weight for one period (decrypted per draw to bound FHE randomness;
///     KMS-signature-verified on-chain via FHE.checkSignatures — comparable to a public TVL)
///   - the participant list and count (addresses that ever held tickets; amounts stay hidden)
///   - transaction timing/graph, and mock-yield harvest amounts (plaintext by nature)
///
/// Draw = 3-phase state machine (paginated to respect the per-tx HCU budget):
///   1. startDraw()     — snapshot total weight, make ONLY that aggregate publicly decryptable
///   2. seedDraw(ct, p) — anyone relays the KMS public decryption + proof; verified on-chain;
///                        per-tier threshold r = FHE.randEuint128() % W (on-chain FHE randomness)
///   3. drawPage(n)*    — walk participants in pages; first cumsum > r wins tier (encrypted)
///
/// Fairness: r is uniform in [0, W-1] and the final cumulative sum equals W, so exactly one
/// winner per tier ALWAYS exists and win probability is exactly weight/W. TWAB weighting means
/// depositing right before a draw earns almost no odds — no draw sniping.
///
/// No admin keys: nothing here is ownable, pausable, or upgradeable. Config is immutable.
contract ConfidentialPrizePool is ERC7984, ZamaEthereumConfig {
    // ---------------------------------------------------------------- types

    enum DrawState {
        Open, // deposits/withdraws/transfers live; draw may be started when due
        AwaitingSeed, // total weight awaiting relayed KMS public decryption
        Selecting // paginated winner selection in progress; share moves frozen
    }

    // ---------------------------------------------------------------- config (immutable)

    /// @notice The confidential ERC-7984 asset users deposit (e.g. cUSDC).
    IERC7984 public immutable asset;
    /// @notice Seconds between draws.
    uint64 public immutable drawPeriod;

    /// @notice Prize tiers in basis points of the prize reserve at seed time (sum ≤ 10000).
    uint16[] private _tierBps;

    /// drawPage loops ~20 FHE ops per participant per page entry (1 scalar-mul128 + adds + 6 ops
    /// per tier). PrivateOTC measured ~16 ops/entity as the safe Sepolia HCU budget per tx, so cap
    /// pages at 3 participants. ponytail: constant cap — retune on-chain data may allow 4-5.
    uint256 public constant MAX_PAGE = 3;

    // ---------------------------------------------------------------- TWAB accounting

    // Encrypted balance-seconds accumulated per account, and the (public) last accrual timestamp.
    // Tx timestamps are public anyway, so a public `lastAccrual` leaks nothing new.
    mapping(address => euint128) private _twab;
    mapping(address => uint64) private _twabLast;
    // Accumulator value at the account's last processed draw — weight for a draw is the delta.
    mapping(address => euint128) private _twabCheckpoint;

    euint128 private _totalTwab;
    uint64 private _totalTwabLast;
    euint128 private _totalTwabCheckpoint;

    // Everyone who ever held tickets. Never pruned: whether a member's balance is now zero is
    // encrypted, and zero-weight members mathematically cannot win (cumsum doesn't move).
    address[] private _participants;
    mapping(address => bool) private _isParticipant;

    // ---------------------------------------------------------------- prizes

    euint64 private _prizeReserve;
    mapping(address => euint64) private _winnings;

    // ---------------------------------------------------------------- draw state

    DrawState public drawState;
    uint32 public drawId;
    uint64 public nextDrawAt;

    uint64 private _snapshotTs;
    euint128 private _snapshotW; // publicly decryptable aggregate (the documented leak)
    /// @notice Total weight of the last seeded draw — public by design, powers the odds meter.
    uint128 public lastDrawTotalWeight;

    euint128[] private _thresholds; // r per tier
    ebool[] private _found; // tier winner already passed? (encrypted)
    euint64[] private _tierPrize; // prize per tier (encrypted)
    euint128 private _cumsum;
    uint256 public drawCursor;

    // ---------------------------------------------------------------- events

    event Deposited(address indexed account);
    event Withdrawn(address indexed account);
    event PrizeSponsored(address indexed sponsor);
    event Claimed(address indexed account);
    event DrawStarted(uint32 indexed drawId, uint64 snapshotTs, bytes32 totalWeightHandle);
    event DrawSeeded(uint32 indexed drawId, uint128 totalWeight);
    event DrawPageProcessed(uint32 indexed drawId, uint256 cursor);
    event DrawCompleted(uint32 indexed drawId, uint128 totalWeight);
    event DrawCancelled(uint32 indexed drawId); // zero total weight — prize rolls over

    // ---------------------------------------------------------------- construction

    constructor(
        address asset_,
        uint64 drawPeriod_,
        uint16[] memory tierBps_
    ) ERC7984("Samar Prize Ticket", "SPT", "") {
        require(asset_ != address(0), "bad asset");
        require(drawPeriod_ > 0, "bad period");
        require(tierBps_.length > 0, "no tiers");
        uint256 sum;
        for (uint256 i = 0; i < tierBps_.length; i++) sum += tierBps_[i];
        require(sum > 0 && sum <= 10000, "bad tiers");
        asset = IERC7984(asset_);
        drawPeriod = drawPeriod_;
        _tierBps = tierBps_;
        nextDrawAt = uint64(block.timestamp) + drawPeriod_;
    }

    // ---------------------------------------------------------------- deposit / withdraw (no loss)

    /// @notice Deposit an encrypted amount of `asset`; mints the same amount of tickets 1:1.
    ///         Caller must first `asset.setOperator(pool, until)`. Deposits more than the caller's
    ///         balance move 0 (ERC-7984 semantics) — nothing ever reverts on a secret.
    function deposit(externalEuint64 encAmount, bytes calldata proof) external {
        euint64 amount = FHE.fromExternal(encAmount, proof);
        FHE.allowTransient(amount, address(asset));
        euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, moved);
        emit Deposited(msg.sender);
    }

    /// @notice Withdraw an encrypted amount of principal — any time, in full (no loss). Requesting
    ///         more than the ticket balance burns/pays 0 (never reverts on a secret).
    function withdraw(externalEuint64 encAmount, bytes calldata proof) external {
        euint64 amount = FHE.fromExternal(encAmount, proof);
        _withdraw(amount);
    }

    /// @notice Withdraw the caller's entire principal.
    function exit() external {
        euint64 balance = confidentialBalanceOf(msg.sender);
        require(FHE.isInitialized(balance), "no balance");
        _withdraw(balance);
    }

    function _withdraw(euint64 amount) private {
        euint64 burned = _burn(msg.sender, amount); // insufficient balance → burns 0 (FHESafeMath)
        FHE.allowTransient(burned, address(asset));
        asset.confidentialTransfer(msg.sender, burned);
        emit Withdrawn(msg.sender);
    }

    // ---------------------------------------------------------------- prize funding

    /// @notice Sponsor the prize reserve with an encrypted amount — nobody learns how much.
    ///         Caller must first `asset.setOperator(pool, until)`.
    function sponsorPrize(externalEuint64 encAmount, bytes calldata proof) external {
        _sponsor(FHE.fromExternal(encAmount, proof));
    }

    /// @notice Sponsor with a plaintext amount — for yield sources whose accrual is public anyway.
    function sponsorPrizePlain(uint64 amount) external {
        _sponsor(FHE.asEuint64(amount));
    }

    function _sponsor(euint64 amount) private {
        FHE.allowTransient(amount, address(asset));
        euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), amount);
        euint64 reserve = FHE.isInitialized(_prizeReserve) ? FHE.add(_prizeReserve, moved) : moved;
        FHE.allowThis(reserve);
        _prizeReserve = reserve;
        emit PrizeSponsored(msg.sender);
    }

    // ---------------------------------------------------------------- claiming

    /// @notice Claim winnings. EVERY participant can call this — a loser transfers an encrypted 0,
    ///         a winner their prize — so claiming reveals nothing about who won.
    function claim() external {
        euint64 amount = _winnings[msg.sender];
        require(FHE.isInitialized(amount), "nothing to claim");
        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        FHE.allow(zero, msg.sender);
        _winnings[msg.sender] = zero;
        FHE.allowTransient(amount, address(asset));
        asset.confidentialTransfer(msg.sender, amount);
        emit Claimed(msg.sender);
    }

    // ---------------------------------------------------------------- draw phase 1: snapshot

    /// @notice Start a draw once due. Permissionless (keeper, Chainlink Automation, or anyone).
    function startDraw() public {
        require(drawState == DrawState.Open, "draw not open");
        require(block.timestamp >= nextDrawAt, "draw not due");
        require(_participants.length > 0, "no participants");

        uint64 nowTs = uint64(block.timestamp);
        _accrueTotal(nowTs);
        _snapshotTs = nowTs;

        euint128 w;
        if (!FHE.isInitialized(_totalTwab)) {
            w = FHE.asEuint128(0);
        } else if (FHE.isInitialized(_totalTwabCheckpoint)) {
            w = FHE.sub(_totalTwab, _totalTwabCheckpoint);
        } else {
            w = _totalTwab;
        }
        // The ONLY value a draw ever discloses: the pool-wide weight for this period.
        w = FHE.makePubliclyDecryptable(w);
        _snapshotW = w;

        drawState = DrawState.AwaitingSeed;
        emit DrawStarted(drawId, nowTs, FHE.toBytes32(w));
    }

    // ---------------------------------------------------------------- draw phase 2: seed

    /// @notice Relay the KMS public decryption of the snapshot weight. Trustless: the cleartext is
    ///         verified against KMS threshold signatures on-chain — a fake value cannot pass.
    ///         Then draws each tier's threshold with on-chain FHE randomness.
    function seedDraw(bytes calldata cleartexts, bytes calldata decryptionProof) external {
        require(drawState == DrawState.AwaitingSeed, "not awaiting seed");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_snapshotW);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);
        uint128 totalWeight = abi.decode(cleartexts, (uint128));

        if (totalWeight == 0) {
            // Nobody held tickets this period — roll the prize over and reopen.
            drawState = DrawState.Open;
            nextDrawAt = _snapshotTs + drawPeriod;
            emit DrawCancelled(drawId);
            drawId++;
            return;
        }
        lastDrawTotalWeight = totalWeight;

        delete _thresholds;
        delete _found;
        delete _tierPrize;

        euint64 reserve = FHE.isInitialized(_prizeReserve) ? _prizeReserve : FHE.asEuint64(0);
        // Floor-divide once so Σ tier prizes ≤ reserve by construction.
        // ponytail: loses < 10000 base units (~0.01 token) of precision per draw — rolls over.
        euint64 unit = FHE.div(reserve, 10000);
        euint64 spent = FHE.asEuint64(0);
        for (uint256 t = 0; t < _tierBps.length; t++) {
            euint64 prize = FHE.mul(unit, uint64(_tierBps[t]));
            FHE.allowThis(prize);
            _tierPrize.push(prize);
            spent = FHE.add(spent, prize);

            // Uniform threshold in [0, W-1] from on-chain FHE randomness; stays encrypted.
            euint128 r = FHE.rem(FHE.randEuint128(), totalWeight);
            FHE.allowThis(r);
            _thresholds.push(r);

            ebool found = FHE.asEbool(false);
            FHE.allowThis(found);
            _found.push(found);
        }
        euint64 newReserve = FHE.sub(reserve, spent);
        FHE.allowThis(newReserve);
        _prizeReserve = newReserve;

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        _cumsum = zero;
        drawCursor = 0;
        drawState = DrawState.Selecting;
        emit DrawSeeded(drawId, totalWeight);
    }

    // ---------------------------------------------------------------- draw phase 3: select

    /// @notice Process up to `count` (≤ MAX_PAGE) participants of the current draw. Permissionless.
    ///         For each tier the FIRST participant whose encrypted cumulative weight exceeds the
    ///         encrypted threshold wins; the prize is credited with FHE.select to every walked
    ///         participant (winner: prize, others: 0) so the winner's identity never surfaces.
    function drawPage(uint256 count) public {
        require(drawState == DrawState.Selecting, "not selecting");
        if (count == 0 || count > MAX_PAGE) count = MAX_PAGE;

        uint256 n = _participants.length;
        uint256 end = drawCursor + count;
        if (end > n) end = n;
        uint256 tiers = _tierBps.length;

        euint128 cum = _cumsum;
        euint64 zero64 = FHE.asEuint64(0);

        for (uint256 i = drawCursor; i < end; i++) {
            address account = _participants[i];

            // Weight this period = accumulator at snapshot minus the account's last checkpoint.
            euint128 acc = _accruedAt(account, _snapshotTs);
            euint128 weight = FHE.isInitialized(_twabCheckpoint[account])
                ? FHE.sub(acc, _twabCheckpoint[account])
                : acc;
            cum = FHE.add(cum, weight);

            euint64 credit = zero64;
            for (uint256 t = 0; t < tiers; t++) {
                ebool isWinner = FHE.and(FHE.gt(cum, _thresholds[t]), FHE.not(_found[t]));
                ebool found = FHE.or(_found[t], isWinner);
                FHE.allowThis(found);
                _found[t] = found;
                credit = FHE.add(credit, FHE.select(isWinner, _tierPrize[t], zero64));
            }
            euint64 winnings = FHE.isInitialized(_winnings[account])
                ? FHE.add(_winnings[account], credit)
                : credit;
            FHE.allowThis(winnings);
            FHE.allow(winnings, account);
            _winnings[account] = winnings;

            // Checkpoint the account at the snapshot — next draw weighs only the new period.
            FHE.allowThis(acc);
            FHE.allow(acc, account);
            _twab[account] = acc;
            _twabCheckpoint[account] = acc;
            _twabLast[account] = _snapshotTs;
        }

        FHE.allowThis(cum);
        _cumsum = cum;
        drawCursor = end;

        if (end == n) {
            _totalTwabCheckpoint = _totalTwab; // accrued to _snapshotTs in startDraw
            uint64 next = _snapshotTs + drawPeriod;
            nextDrawAt = next > uint64(block.timestamp) ? next : uint64(block.timestamp) + drawPeriod;
            drawState = DrawState.Open;
            emit DrawCompleted(drawId, lastDrawTotalWeight);
            drawId++;
        } else {
            emit DrawPageProcessed(drawId, end);
        }
    }

    // ---------------------------------------------------------------- Chainlink Automation

    /// @notice AutomationCompatibleInterface — register this contract on Chainlink Automation to
    ///         run draws hands-free. The AwaitingSeed phase needs an off-chain KMS decryption
    ///         relay, which any keeper (or the dApp's "crank" button) provides via seedDraw.
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded =
            (drawState == DrawState.Open && block.timestamp >= nextDrawAt && _participants.length > 0) ||
            drawState == DrawState.Selecting;
        return (upkeepNeeded, "");
    }

    function performUpkeep(bytes calldata) external {
        if (drawState == DrawState.Open) startDraw();
        else if (drawState == DrawState.Selecting) drawPage(0);
        else revert("awaiting seed relay");
    }

    // ---------------------------------------------------------------- TWAB internals

    /// @dev Balance-touching operations accrue TWAB first (using pre-update balances) and are
    ///      frozen while a draw is selecting, so weights are consistent across draw pages.
    function _update(address from, address to, euint64 amount) internal override returns (euint64) {
        require(drawState == DrawState.Open, "draw in progress");
        uint64 nowTs = uint64(block.timestamp);
        if (from != address(0)) _accrue(from, nowTs);
        if (to != address(0)) {
            _accrue(to, nowTs);
            if (!_isParticipant[to]) {
                _isParticipant[to] = true;
                _participants.push(to);
            }
        }
        _accrueTotal(nowTs);
        return super._update(from, to, amount);
    }

    function _accrue(address account, uint64 nowTs) private {
        uint64 last = _twabLast[account];
        _twabLast[account] = nowTs;
        if (last == 0 || last == nowTs) return; // first touch, or already accrued this block
        euint128 acc = _accruedFrom(_twab[account], confidentialBalanceOf(account), nowTs - last);
        if (!FHE.isInitialized(acc)) return;
        FHE.allowThis(acc);
        FHE.allow(acc, account);
        _twab[account] = acc;
    }

    function _accrueTotal(uint64 nowTs) private {
        uint64 last = _totalTwabLast;
        _totalTwabLast = nowTs;
        if (last == 0 || last == nowTs) return;
        euint128 acc = _accruedFrom(_totalTwab, confidentialTotalSupply(), nowTs - last);
        if (!FHE.isInitialized(acc)) return;
        FHE.allowThis(acc);
        _totalTwab = acc;
    }

    /// @dev accumulator + balance × Δt (scalar mul — Δt is public since tx timestamps are public).
    ///      Max magnitude ~2^64 balance × decades of seconds ≪ 2^128: no overflow in practice.
    function _accruedFrom(euint128 twab, euint64 balance, uint64 delta) private returns (euint128) {
        if (!FHE.isInitialized(balance)) return twab;
        euint128 grown = FHE.mul(FHE.asEuint128(balance), uint128(delta));
        return FHE.isInitialized(twab) ? FHE.add(twab, grown) : grown;
    }

    /// @dev Accumulator value as of `ts` WITHOUT mutating accrual bookkeeping (used inside a draw,
    ///      where balances are frozen and _twabLast[account] ≤ ts always holds).
    function _accruedAt(address account, uint64 ts) private returns (euint128) {
        uint64 last = _twabLast[account];
        euint128 acc = _accruedFrom(_twab[account], confidentialBalanceOf(account), ts - last);
        return FHE.isInitialized(acc) ? acc : FHE.asEuint128(0);
    }

    // ---------------------------------------------------------------- views

    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    function participantAt(uint256 i) external view returns (address) {
        return _participants[i];
    }

    function tierCount() external view returns (uint256) {
        return _tierBps.length;
    }

    function tierBps(uint256 i) external view returns (uint16) {
        return _tierBps[i];
    }

    /// @notice Encrypted handles — decryptable only by their owner via the EIP-712 user-decryption
    ///         flow (and by this contract). Anyone else sees an opaque handle.
    function winningsOf(address account) external view returns (euint64) {
        return _winnings[account];
    }

    function twabOf(address account) external view returns (euint128) {
        return _twab[account];
    }

    function twabCheckpointOf(address account) external view returns (euint128) {
        return _twabCheckpoint[account];
    }

    function twabLastOf(address account) external view returns (uint64) {
        return _twabLast[account];
    }

    /// @notice The prize reserve handle — intentionally NOT user-decryptable by anyone.
    function prizeReserve() external view returns (euint64) {
        return _prizeReserve;
    }

    /// @notice Handle of the current draw's publicly-decryptable total weight (phase 2 input).
    function snapshotWeightHandle() external view returns (bytes32) {
        return FHE.toBytes32(_snapshotW);
    }

    function snapshotTs() external view returns (uint64) {
        return _snapshotTs;
    }
}
