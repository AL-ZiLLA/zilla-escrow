// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockStablecoin
/// @notice TESTNET ONLY. A 6-decimal stand-in for USDC/USDG with an open faucet mint.
///         It has no value and must never be deployed to a mainnet.
contract MockStablecoin is ERC20 {
    uint256 public constant FAUCET_LIMIT = 1_000_000e6;

    error FaucetLimit();

    constructor() ERC20("Zilla Test USD (mock, no value)", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint up to FAUCET_LIMIT test tokens per call to any address.
    function mint(address to, uint256 amount) external {
        if (amount > FAUCET_LIMIT) revert FaucetLimit();
        _mint(to, amount);
    }
}
