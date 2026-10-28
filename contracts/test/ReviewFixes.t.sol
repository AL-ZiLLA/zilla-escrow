// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base} from "./utils/Base.t.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";

/// Regression tests for the 2026-10-28 review (S1-S4). The three PoCs from
/// review-2026-10-28/ReviewPoC.t.sol.txt are inverted here: each attack now fails.
contract ReviewFixesTest is Base {
    // ------------------------------------------------------------------ S2

    function test_S2_clientCannotReclaimDeliveredWorkViaUnfundedTopUp() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(provider);
        uint256 co = escrow.proposeChangeOrder(id, _co(0, 1e6, due));
        vm.prank(client);
        escrow.approveChangeOrder(id, co);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Funded));
        vm.warp(due + 7 days + 1);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.refundExpired(id, 0);

        // The normal path still works: client tops up the delta, provider resubmits, release.
        _fund(id, 0);
        _submit(id, 0);
        uint256 before = usd.balanceOf(provider);
        vm.prank(client);
        escrow.release(id, 0);
        assertEq(usd.balanceOf(provider) - before, M0 + 1e6);
    }

    function test_S2_undeliveredMilestoneStillRefundsAfterGrace() public {
        uint256 id = _active();
        _fund(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.warp(due + 7 days + 1);
        uint256 before = usd.balanceOf(client);
        vm.prank(client);
        escrow.refundExpired(id, 0);
        assertEq(usd.balanceOf(client) - before, M0);
    }

    // ------------------------------------------------------------------ S1

    function test_S1_disputeHasTimeoutExit_noProofRefundsClient() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);
        assertEq(escrow.disputedAt(id, 0), block.timestamp);

        vm.warp(block.timestamp + escrow.ARBITER_TIMEOUT() - 1);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.TooEarly.selector);
        escrow.resolveDisputeAfterTimeout(id, 0);

        vm.warp(block.timestamp + 1);
        uint256 before = usd.balanceOf(client);
        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.DisputeResolved(id, 0, address(0), 0, M0);
        vm.prank(provider);
        escrow.resolveDisputeAfterTimeout(id, 0);
        assertEq(usd.balanceOf(client) - before, M0);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Resolved));
        assertEq(escrow.escrowed(IERC20(address(usd))), 0);

        vm.prank(arbiter);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.resolveDispute(id, 0, 0);
    }

    function test_S1_disputeTimeout_withProofSplitsEvenly() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(provider);
        escrow.openDispute(id, 0);
        vm.warp(block.timestamp + escrow.ARBITER_TIMEOUT());
        uint256 c0 = usd.balanceOf(client);
        uint256 p0 = usd.balanceOf(provider);
        vm.prank(client);
        escrow.resolveDisputeAfterTimeout(id, 0);
        assertEq(usd.balanceOf(provider) - p0, M0 / 2);
        assertEq(usd.balanceOf(client) - c0, M0 - M0 / 2);
    }

    function test_S1_disputeTimeout_guards() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.resolveDisputeAfterTimeout(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);
        vm.warp(block.timestamp + 365 days);
        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.resolveDisputeAfterTimeout(id, 0);
        vm.prank(arbiter);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.resolveDisputeAfterTimeout(id, 0);
    }

    function test_S1_arbiterStillRulesBeforeTimeout() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);
        vm.warp(block.timestamp + 29 days);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, 1_000e6);
        vm.warp(block.timestamp + 30 days);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.resolveDisputeAfterTimeout(id, 0);
    }

    // ------------------------------------------------------------------ S3

    function test_S3_providerCannotSwapAgentWithoutClientConsent() public {
        uint256 id = _active();
        _fund(id, 0);
        address newAgent = makeAddr("newAgent");
        vm.prank(provider);
        escrow.setAgent(id, newAgent, 7);
        assertEq(escrow.pendingAgent(id), newAgent);
        assertEq(escrow.pendingAgentIdentity(id), 7);
        vm.prank(newAgent);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");
        // The original agent keeps working until the client consents.
        _submit(id, 0);
    }

    function test_S3_approveAgent_guards() public {
        uint256 id = _active();
        address newAgent = makeAddr("newAgent");
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.InvalidAddress.selector);
        escrow.approveAgent(id, newAgent);

        vm.prank(provider);
        escrow.setAgent(id, newAgent, 0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.approveAgent(id, newAgent);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.InvalidAddress.selector);
        escrow.approveAgent(id, makeAddr("other"));

        // A later proposal replaces the earlier one; clearing drops any pending proposal.
        vm.prank(provider);
        escrow.setAgent(id, address(0), 0);
        assertEq(escrow.pendingAgent(id), address(0));
        assertEq(escrow.getAgreement(id).agent, address(0));
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.InvalidAddress.selector);
        escrow.approveAgent(id, newAgent);
    }

    function test_S3_setAgentBeforeAcceptanceIsImmediate() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        address newAgent = makeAddr("newAgent");
        vm.prank(provider);
        escrow.setAgent(id, newAgent, 0);
        assertEq(escrow.getAgreement(id).agent, newAgent);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.approveAgent(id, newAgent);
    }

    // ------------------------------------------------------------------ S4 branch coverage

    function test_S4_cancelWhenNotProposed() public {
        uint256 id = _active();
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.cancelAgreement(id);
    }

    function test_S4_setAgentOnCancelled() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(provider);
        escrow.cancelAgreement(id);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.setAgent(id, makeAddr("x"), 0);
    }

    function test_S4_refundExpiredByNonClient() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.warp(block.timestamp + 60 days);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.refundExpired(id, 0);
    }

    function test_S4_declineAndCancelNonProposedChangeOrder() public {
        uint256 id = _active();
        uint64 due = escrow.getMilestone(id, 1).dueDate;
        vm.prank(provider);
        uint256 c0 = escrow.proposeChangeOrder(id, _co(1, 100e6, due));
        vm.prank(client);
        escrow.approveChangeOrder(id, c0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongChangeOrderStatus.selector);
        escrow.declineChangeOrder(id, c0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongChangeOrderStatus.selector);
        escrow.cancelChangeOrder(id, c0);
    }

    function test_S4_maxMilestonesViaChangeOrder() public {
        ZillaEscrow.AgreementInput memory input = _input(IERC20(address(usd)));
        uint256 n = escrow.MAX_MILESTONES();
        ZillaEscrow.MilestoneInput[] memory ms = new ZillaEscrow.MilestoneInput[](n);
        for (uint256 i; i < n; ++i) {
            ms[i] = ZillaEscrow.MilestoneInput({
                amount: 1e6, dueDate: uint64(block.timestamp + 1 days + i), phaseRef: "P"
            });
        }
        input.milestones = ms;
        vm.prank(provider);
        uint256 id = escrow.createAgreement(input);
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1, agent);
        uint32 NEW = escrow.NEW_MILESTONE();
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.TooManyMilestones.selector);
        escrow.proposeChangeOrder(id, _co(NEW, 1e6, uint64(block.timestamp + 90 days)));
    }

    function test_S4_changeOrderAmountOverflow() public {
        uint256 id = _active();
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidAmount.selector);
        escrow.proposeChangeOrder(id, _co(0, type(uint128).max, due));
    }

    // ------------------------------------------------------------------ regrade R3 / R6

    /// R3: a day-1 dispute no longer blocks delivery. Proof can be posted while Disputed and the
    /// milestone stays with the arbiter; the timeout then splits instead of refunding in full.
    function test_R3_proofCanBePostedDuringDispute() public {
        uint256 id = _active();
        _fund(id, 1);
        vm.prank(client);
        escrow.openDispute(id, 1);

        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.ProofSubmitted(id, 1, agent, PROOF, "ipfs://proof");
        _submit(id, 1);
        ZillaEscrow.Milestone memory m = escrow.getMilestone(id, 1);
        assertEq(uint8(m.status), uint8(ZillaEscrow.MilestoneStatus.Disputed));
        assertEq(m.proofHash, PROOF);
        assertEq(m.submittedAt, block.timestamp);

        // The dispute stays open: no review-period claim, and the client cannot release around it.
        vm.warp(block.timestamp + escrow.REVIEW_PERIOD() + 1);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.claimAfterReview(id, 1);

        vm.warp(uint256(escrow.disputedAt(id, 1)) + escrow.ARBITER_TIMEOUT());
        uint256 p0 = usd.balanceOf(provider);
        uint256 c0 = usd.balanceOf(client);
        vm.prank(provider);
        escrow.resolveDisputeAfterTimeout(id, 1);
        assertEq(usd.balanceOf(provider) - p0, M1 / 2);
        assertEq(usd.balanceOf(client) - c0, M1 - M1 / 2);
    }

    /// R3: with no proof, the timeout refund waits for due date + REFUND_GRACE as well, so an
    /// early dispute cannot claw back work that is not due yet.
    function test_R3_noProofRefundWaitsForDueDatePlusGrace() public {
        uint256 id = _active();
        _fund(id, 1); // due at +42 days, so refundable after +49 days
        vm.prank(client);
        escrow.openDispute(id, 1);
        uint256 dueGrace = uint256(escrow.getMilestone(id, 1).dueDate) + escrow.REFUND_GRACE();

        vm.warp(uint256(escrow.disputedAt(id, 1)) + escrow.ARBITER_TIMEOUT());
        assertLt(block.timestamp, dueGrace);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.TooEarly.selector);
        escrow.resolveDisputeAfterTimeout(id, 1);

        vm.warp(dueGrace);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.TooEarly.selector);
        escrow.resolveDisputeAfterTimeout(id, 1);

        vm.warp(dueGrace + 1);
        uint256 c0 = usd.balanceOf(client);
        vm.prank(client);
        escrow.resolveDisputeAfterTimeout(id, 1);
        assertEq(usd.balanceOf(client) - c0, M1);
        assertEq(escrow.escrowed(IERC20(address(usd))), 0);
    }

    /// R3: proof during a dispute keeps the usual guards.
    function test_R3_proofDuringDispute_guards() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);
        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidHash.selector);
        escrow.submitProof(id, 0, bytes32(0), "");
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, 0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.submitProof(id, 0, PROOF, "");
    }

    /// R6: the agent is bound into acceptance. A provider swap right before the client accepts
    /// makes the client's acceptance revert instead of silently binding an unseen agent.
    function test_R6_agentSwapBeforeAcceptanceIsRejected() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        address swapped = makeAddr("swapped");
        vm.prank(provider);
        escrow.setAgent(id, swapped, 0);

        vm.prank(client);
        vm.expectRevert(ZillaEscrow.AgentMismatch.selector);
        escrow.acceptAgreement(id, SCOPE_V1, agent);
        assertEq(uint8(escrow.getAgreement(id).status), uint8(ZillaEscrow.AgreementStatus.Proposed));

        // The client can still accept knowingly, naming the agent it saw.
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1, swapped);
        assertEq(escrow.getAgreement(id).agent, swapped);
    }

    /// R6: an agreement without an agent is accepted with address(0), and naming one fails.
    function test_R6_noAgentAcceptsWithZeroAddress() public {
        ZillaEscrow.AgreementInput memory input = _input(IERC20(address(usd)));
        input.agent = address(0);
        vm.prank(provider);
        uint256 id = escrow.createAgreement(input);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.AgentMismatch.selector);
        escrow.acceptAgreement(id, SCOPE_V1, agent);
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1, address(0));
        assertEq(uint8(escrow.getAgreement(id).status), uint8(ZillaEscrow.AgreementStatus.Active));
    }
}
