// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";

/// Deploys the escrow and the test-only mock stablecoin.
/// Usage: forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
///        with DEPLOYER_PK exported from a key file outside the repo.
contract Deploy is Script {
    function run() external returns (ZillaEscrow escrow, MockStablecoin usd) {
        require(block.chainid == 421614 || block.chainid == 31337, "testnet only");
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);
        usd = new MockStablecoin();
        escrow = new ZillaEscrow();
        vm.stopBroadcast();
        console2.log("MockStablecoin", address(usd));
        console2.log("ZillaEscrow", address(escrow));
    }
}
