// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base} from "./utils/Base.t.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";

contract ZillaEscrowFuzzTest is Base {
    function _single(uint128 amount, uint64 dueIn) internal returns (uint256 id) {
        ZillaEscrow.AgreementInput memory input = _input(IERC20(address(usd)));
        input.milestones = new ZillaEscrow.MilestoneInput[](1);
        input.milestones[0] =
            ZillaEscrow.MilestoneInput(amount, uint64(block.timestamp) + dueIn, "P1");
        vm.prank(provider);
        id = escrow.createAgreement(input);
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1);
    }

    function testFuzz_fundRelease_conservesValue(uint128 amount, uint64 dueIn) public {
        amount = uint128(bound(amount, 1, 1_000_000e6));
        dueIn = uint64(bound(dueIn, 1, 3650 days));
        uint256 id = _single(amount, dueIn);
        uint256 clientStart = usd.balanceOf(client);

        _fund(id, 0);
        assertEq(usd.balanceOf(address(escrow)), amount);
        _submit(id, 0);
        vm.prank(client);
        escrow.release(id, 0);

        assertEq(usd.balanceOf(provider), amount);
        assertEq(usd.balanceOf(client), clientStart - amount);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }

    function testFuzz_changeOrder_topUpThenRelease(uint128 amount, uint128 delta, uint32 extendBy)
        public
    {
        amount = uint128(bound(amount, 1, 400_000e6));
        delta = uint128(bound(delta, 1, 400_000e6));
        extendBy = uint32(bound(extendBy, 0, 365 days));
        uint256 id = _single(amount, 30 days);
        _fund(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;

        vm.prank(provider);
        uint256 coId = escrow.proposeChangeOrder(id, _co(0, delta, due + extendBy));
        vm.prank(client);
        escrow.approveChangeOrder(id, coId);

        ZillaEscrow.Milestone memory m = escrow.getMilestone(id, 0);
        assertEq(m.amount, uint256(amount) + delta);
        assertEq(m.dueDate, due + extendBy);
        assertEq(escrow.getAgreement(id).baselineHash, SCOPE_V1);

        _fund(id, 0);
        assertEq(usd.balanceOf(address(escrow)), uint256(amount) + delta);
        _submit(id, 0);
        vm.prank(client);
        escrow.release(id, 0);
        assertEq(usd.balanceOf(provider), uint256(amount) + delta);
    }

    function testFuzz_dispute_splitIsExact(uint128 amount, uint128 toProvider) public {
        amount = uint128(bound(amount, 1, 1_000_000e6));
        toProvider = uint128(bound(toProvider, 0, amount));
        uint256 id = _single(amount, 30 days);
        uint256 clientStart = usd.balanceOf(client);
        _fund(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, toProvider);
        assertEq(usd.balanceOf(provider), toProvider);
        assertEq(usd.balanceOf(client), clientStart - toProvider);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }

    function testFuzz_refundExpired_onlyAfterGrace(uint128 amount, uint64 dueIn, uint64 waitFor)
        public
    {
        amount = uint128(bound(amount, 1, 1_000_000e6));
        dueIn = uint64(bound(dueIn, 1, 365 days));
        waitFor = uint64(bound(waitFor, 0, 800 days));
        uint256 id = _single(amount, dueIn);
        uint256 clientStart = usd.balanceOf(client);
        _fund(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        uint256 grace = escrow.REFUND_GRACE();
        vm.warp(block.timestamp + waitFor);
        vm.prank(client);
        if (block.timestamp <= uint256(due) + grace) {
            vm.expectRevert(ZillaEscrow.TooEarly.selector);
            escrow.refundExpired(id, 0);
            assertEq(usd.balanceOf(address(escrow)), amount);
        } else {
            escrow.refundExpired(id, 0);
            assertEq(usd.balanceOf(client), clientStart);
        }
    }

    function testFuzz_strangerCannotMoveFunds(address who) public {
        vm.assume(who != client && who != provider && who != agent && who != arbiter);
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.startPrank(who);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.release(id, 0);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.refundByProvider(id, 0);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.claimAfterReview(id, 0);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.openDispute(id, 0);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.resolveDispute(id, 0, 0);
        vm.stopPrank();
        assertEq(usd.balanceOf(address(escrow)), M0);
    }
}
