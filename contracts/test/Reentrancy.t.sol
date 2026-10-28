// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";
import {HookToken, ITransferHook} from "./utils/HostileTokens.sol";

/// A party contract that tries to re-enter the escrow from inside a token transfer.
contract Attacker is ITransferHook {
    ZillaEscrow public immutable escrow;
    bytes public payload;
    bool public armed;
    bool public reenterSucceeded;
    bytes4 public revertSelector;

    constructor(ZillaEscrow e) {
        escrow = e;
    }

    function call(bytes calldata data) external {
        (bool ok, bytes memory ret) = address(escrow).call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function approve(IERC20 t) external {
        t.approve(address(escrow), type(uint256).max);
    }

    function arm(bytes calldata data) external {
        payload = data;
        armed = true;
    }

    function onTokenTransfer() external {
        if (!armed) return;
        armed = false;
        (bool ok, bytes memory ret) = address(escrow).call(payload);
        reenterSucceeded = ok;
        if (!ok && ret.length >= 4) revertSelector = bytes4(ret);
    }
}

contract ReentrancyTest is Test {
    ZillaEscrow escrow;
    HookToken token;
    Attacker clientBot;
    Attacker providerBot;
    address arbiter = makeAddr("arbiter");
    bytes32 constant SCOPE = keccak256("s");

    function setUp() public {
        escrow = new ZillaEscrow();
        token = new HookToken();
        clientBot = new Attacker(escrow);
        providerBot = new Attacker(escrow);
        token.mint(address(clientBot), 1_000_000e6);
        clientBot.approve(IERC20(address(token)));
    }

    function _agreement() internal returns (uint256 id) {
        ZillaEscrow.MilestoneInput[] memory ms = new ZillaEscrow.MilestoneInput[](2);
        ms[0] = ZillaEscrow.MilestoneInput(1_000e6, uint64(block.timestamp + 1 days), "P1");
        ms[1] = ZillaEscrow.MilestoneInput(1_000e6, uint64(block.timestamp + 2 days), "P2");
        ZillaEscrow.AgreementInput memory input = ZillaEscrow.AgreementInput({
            client: address(clientBot),
            provider: address(providerBot),
            agent: address(0),
            arbiter: arbiter,
            token: IERC20(address(token)),
            scopeHash: SCOPE,
            scopeURI: "",
            milestones: ms
        });
        providerBot.call(abi.encodeCall(ZillaEscrow.createAgreement, (input)));
        id = escrow.agreementCount();
        clientBot.call(abi.encodeCall(ZillaEscrow.acceptAgreement, (id, SCOPE, address(0))));
    }

    function test_reenterFundDuringFund_blocked() public {
        uint256 id = _agreement();
        token.setHook(address(clientBot));
        clientBot.arm(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 1)));
        clientBot.call(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 0)));
        assertFalse(clientBot.reenterSucceeded());
        assertEq(clientBot.revertSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(escrow.getMilestone(id, 1).funded, 0);
    }

    function test_reenterRefundDuringRelease_blocked() public {
        uint256 id = _agreement();
        clientBot.call(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 0)));
        clientBot.call(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 1)));
        providerBot.call(abi.encodeCall(ZillaEscrow.submitProof, (id, 0, keccak256("p"), "")));

        // provider receives funds and tries to drain milestone 1 back through refundByProvider
        token.setHook(address(providerBot));
        providerBot.arm(abi.encodeCall(ZillaEscrow.refundByProvider, (id, 1)));
        clientBot.call(abi.encodeCall(ZillaEscrow.release, (id, 0)));

        assertFalse(providerBot.reenterSucceeded());
        assertEq(
            providerBot.revertSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector
        );
        assertEq(
            uint8(escrow.getMilestone(id, 1).status), uint8(ZillaEscrow.MilestoneStatus.Funded)
        );
        assertEq(token.balanceOf(address(escrow)), 1_000e6);
    }

    function test_reenterReleaseDuringResolve_blocked() public {
        uint256 id = _agreement();
        clientBot.call(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 0)));
        clientBot.call(abi.encodeCall(ZillaEscrow.fundMilestone, (id, 1)));
        providerBot.call(abi.encodeCall(ZillaEscrow.submitProof, (id, 1, keccak256("p"), "")));
        clientBot.call(abi.encodeCall(ZillaEscrow.openDispute, (id, 0)));

        token.setHook(address(clientBot));
        clientBot.arm(abi.encodeCall(ZillaEscrow.release, (id, 1)));
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, 0);

        assertFalse(clientBot.reenterSucceeded());
        assertEq(clientBot.revertSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(
            uint8(escrow.getMilestone(id, 1).status), uint8(ZillaEscrow.MilestoneStatus.Submitted)
        );
    }
}
