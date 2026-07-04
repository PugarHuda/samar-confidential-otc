// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title SamarCToken
/// @notice ERC-7984 confidential token for the Samar demo (deploy as cUSDC and cETH).
/// @dev Open faucet mint — TESTNET DEMO ONLY.
// ponytail: open mint is intentional (faucet); gate it before any real deployment.
contract SamarCToken is ERC7984, ZamaEthereumConfig {
    constructor(
        string memory name_,
        string memory symbol_,
        string memory uri_
    ) ERC7984(name_, symbol_, uri_) {}

    /// @notice Mint `amount` confidential units to the caller (public amount — faucet).
    function mint(uint64 amount) external {
        _mint(msg.sender, FHE.asEuint64(amount));
    }
}
