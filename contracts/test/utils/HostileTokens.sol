// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITransferHook {
    function onTokenTransfer() external;
}

/// Token that hands control to a hook contract in the middle of every transfer, the way an
/// ERC-777 style or malicious token would. Used to prove the escrow's reentrancy guard holds.
contract HookToken is ERC20 {
    address public hook;

    constructor() ERC20("Hook", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setHook(address h) external {
        hook = h;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (hook != address(0) && from != address(0)) ITransferHook(hook).onTokenTransfer();
    }
}

/// Token that skims 1% on transfer. The escrow must reject it.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
