// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ConfidentialPrizePool} from "./ConfidentialPrizePool.sol";

interface IFaucetToken is IERC7984 {
    function mint(uint64 amount) external;
}

/// @title MockYieldSource — testnet stand-in for a real yield strategy
/// @notice Accrues linear interest on a NOTIONAL principal and, on `harvest()`, mints that yield
///         from the faucet token straight into the pool's prize reserve. The accrual rate and
///         harvest amounts are public — real yield (an Aave/Morpho position) is public too, so
///         this leaks nothing a production deployment wouldn't.
/// @dev Production plug-in path (documented in the README): replace this contract with an adapter
///      that holds the strategy position, harvests real yield, wraps it into the confidential
///      asset via its ERC-7984 wrapper, and calls the same `sponsorPrizePlain`. The pool needs no
///      changes — funding the reserve is permissionless by design.
// ponytail: faucet-minted "yield" is intentional — Sepolia has no dependable native yield.
contract MockYieldSource {
    IFaucetToken public immutable asset;
    ConfidentialPrizePool public immutable pool;

    /// @notice Notional principal the mock strategy "manages" (public, like real TVL).
    uint64 public principal;
    /// @notice Annual rate in basis points (e.g. 1000 = 10% APR).
    uint32 public immutable aprBps;
    uint64 public lastHarvest;

    event Funded(uint64 addedPrincipal, uint64 totalPrincipal);
    event Harvested(uint64 yieldAmount);

    constructor(address asset_, address payable pool_, uint32 aprBps_) {
        asset = IFaucetToken(asset_);
        pool = ConfidentialPrizePool(pool_);
        aprBps = aprBps_;
        lastHarvest = uint64(block.timestamp);
        // One-time approval so the pool can pull every future harvest.
        IFaucetToken(asset_).setOperator(pool_, type(uint48).max);
    }

    /// @notice Raise the notional principal (permissionless — it only increases the prize flow).
    function fund(uint64 amount) external {
        harvest(); // settle at the old rate base first
        principal += amount;
        emit Funded(amount, principal);
    }

    /// @notice Yield accrued since the last harvest.
    function accrued() public view returns (uint64) {
        return uint64((uint256(principal) * aprBps * (block.timestamp - lastHarvest)) / 10000 / 365 days);
    }

    /// @notice Mint the accrued yield and sponsor it into the pool's prize reserve. Permissionless.
    function harvest() public returns (uint64 yieldAmount) {
        yieldAmount = accrued();
        lastHarvest = uint64(block.timestamp);
        if (yieldAmount == 0) return 0;
        asset.mint(yieldAmount); // mock: the faucet stands in for a real strategy's harvest
        pool.sponsorPrizePlain(yieldAmount);
        emit Harvested(yieldAmount);
    }
}
