// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base} from "./utils/Base.t.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {FeeToken} from "./utils/HostileTokens.sol";

contract ZillaEscrowLifecycleTest is Base {
    // ---------------------------------------------------------------- create / accept

    function test_create_storesAgreementAndMilestones() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        assertEq(id, 1);
        ZillaEscrow.Agreement memory a = escrow.getAgreement(id);
        assertEq(a.client, client);
        assertEq(a.provider, provider);
        assertEq(a.creator, provider);
        assertEq(uint8(a.status), uint8(ZillaEscrow.AgreementStatus.Proposed));
        assertEq(a.milestoneCount, 2);
        assertEq(a.version, 0);
        assertEq(a.baselineHash, bytes32(0));
        assertEq(escrow.getMilestones(id)[1].amount, M1);
    }

    function test_accept_freezesBaseline() public {
        uint256 id = _active();
        ZillaEscrow.Agreement memory a = escrow.getAgreement(id);
        assertEq(uint8(a.status), uint8(ZillaEscrow.AgreementStatus.Active));
        assertEq(a.baselineHash, SCOPE_V1);
        assertEq(a.version, 1);
        assertEq(a.acceptedAt, block.timestamp);
    }

    function test_accept_revertsOnWrongHash() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.HashMismatch.selector);
        escrow.acceptAgreement(id, SCOPE_V2);
    }

    function test_accept_creatorCannotSelfAccept() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.acceptAgreement(id, SCOPE_V1);
    }

    function test_accept_strangerCannotAccept() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.acceptAgreement(id, SCOPE_V1);
    }

    function test_create_clientCanCreateAndProviderAccepts() public {
        vm.prank(client);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(provider);
        escrow.acceptAgreement(id, SCOPE_V1);
        assertEq(escrow.getAgreement(id).version, 1);
    }

    function test_create_validation() public {
        ZillaEscrow.AgreementInput memory input = _input(IERC20(address(usd)));

        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotParty.selector);
        escrow.createAgreement(input);

        input.arbiter = client;
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidRoles.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.provider = client;
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.InvalidRoles.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.token = IERC20(address(0));
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidAddress.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.arbiter = address(0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidAddress.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.scopeHash = bytes32(0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidHash.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.milestones[0].amount = 0;
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidAmount.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.milestones[1].dueDate = uint64(block.timestamp);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidDate.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.milestones = new ZillaEscrow.MilestoneInput[](0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidAmount.selector);
        escrow.createAgreement(input);

        input = _input(IERC20(address(usd)));
        input.milestones = new ZillaEscrow.MilestoneInput[](65);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.TooManyMilestones.selector);
        escrow.createAgreement(input);
    }

    function test_cancelAgreement_onlyCreatorWhileProposed() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.cancelAgreement(id);
        vm.prank(provider);
        escrow.cancelAgreement(id);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.acceptAgreement(id, SCOPE_V1);
    }

    function test_actionsBlockedBeforeAcceptance() public {
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.fundMilestone(id, 0);
    }

    function test_unknownAgreementAndMilestone() public {
        vm.expectRevert(ZillaEscrow.WrongAgreementStatus.selector);
        escrow.getAgreement(99);
        uint256 id = _active();
        vm.expectRevert(ZillaEscrow.UnknownMilestone.selector);
        escrow.getMilestone(id, 2);
        vm.expectRevert(ZillaEscrow.UnknownChangeOrder.selector);
        escrow.getChangeOrder(id, 0);
    }

    // ---------------------------------------------------------------- happy path

    function test_happyPath_fundSubmitRelease() public {
        uint256 id = _active();

        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.MilestoneFunded(id, 0, client, M0, M0);
        _fund(id, 0);
        assertEq(usd.balanceOf(address(escrow)), M0);
        assertEq(escrow.escrowed(IERC20(address(usd))), M0);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Funded));

        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.ProofSubmitted(id, 0, agent, PROOF, "ipfs://proof");
        _submit(id, 0);
        ZillaEscrow.Milestone memory m = escrow.getMilestone(id, 0);
        assertEq(m.proofHash, PROOF);
        assertEq(m.submittedAt, block.timestamp);

        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.MilestoneReleased(id, 0, client, M0);
        vm.prank(client);
        escrow.release(id, 0);

        assertEq(usd.balanceOf(provider), M0);
        assertEq(usd.balanceOf(address(escrow)), 0);
        assertEq(escrow.escrowed(IERC20(address(usd))), 0);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Released));
    }

    function test_providerCanSubmitDirectly_andResubmit() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(provider);
        escrow.submitProof(id, 0, keccak256("v1"), "ipfs://v1");
        vm.prank(provider);
        escrow.submitProof(id, 0, keccak256("v2"), "ipfs://v2");
        assertEq(escrow.getMilestone(id, 0).proofHash, keccak256("v2"));
    }

    // ---------------------------------------------------------------- access control

    function test_fund_onlyClient() public {
        uint256 id = _active();
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.fundMilestone(id, 0);
    }

    function test_fund_twiceReverts() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NothingToFund.selector);
        escrow.fundMilestone(id, 0);
    }

    function test_submit_onlyProviderOrAgent() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");
        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");
    }

    function test_submit_requiresFundingAndHash() public {
        uint256 id = _active();
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.submitProof(id, 0, PROOF, "");
        _fund(id, 0);
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.InvalidHash.selector);
        escrow.submitProof(id, 0, bytes32(0), "");
    }

    function test_release_onlyClient_andOnlyAfterSubmit() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.release(id, 0);
        _submit(id, 0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.release(id, 0);
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.release(id, 0);
    }

    function test_setAgent_onlyProvider_andClearing() public {
        uint256 id = _active();
        address agent2 = makeAddr("agent2");
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.setAgent(id, agent2, 0);

        vm.expectEmit(true, true, false, true);
        emit ZillaEscrow.AgentSet(id, agent2, 42);
        vm.prank(provider);
        escrow.setAgent(id, agent2, 42);

        _fund(id, 0);
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");

        vm.prank(provider);
        escrow.setAgent(id, address(0), 0);
        vm.prank(address(0));
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.submitProof(id, 0, PROOF, "");

        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.InvalidRoles.selector);
        escrow.setAgent(id, client, 0);
    }

    // ---------------------------------------------------------------- review timeout

    function test_claimAfterReview() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.TooEarly.selector);
        escrow.claimAfterReview(id, 0);
        uint256 review = escrow.REVIEW_PERIOD();
        vm.warp(block.timestamp + review);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.claimAfterReview(id, 0);
        vm.prank(provider);
        escrow.claimAfterReview(id, 0);
        assertEq(usd.balanceOf(provider), M0);
    }

    function test_claimAfterReview_requiresSubmission() public {
        uint256 id = _active();
        _fund(id, 0);
        vm.warp(block.timestamp + 365 days);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.claimAfterReview(id, 0);
    }

    // ---------------------------------------------------------------- refunds

    function test_refundExpired_afterGrace() public {
        uint256 id = _active();
        _fund(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        uint64 grace = escrow.REFUND_GRACE();
        vm.warp(due + grace);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.TooEarly.selector);
        escrow.refundExpired(id, 0);
        vm.warp(due + grace + 1);
        uint256 before = usd.balanceOf(client);
        vm.prank(client);
        escrow.refundExpired(id, 0);
        assertEq(usd.balanceOf(client), before + M0);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Refunded));
    }

    function test_refundExpired_blockedOnceSubmitted() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.warp(block.timestamp + 365 days);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.refundExpired(id, 0);
    }

    function test_refundByProvider_anyOpenState() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.refundByProvider(id, 0);
        uint256 before = usd.balanceOf(client);
        vm.prank(provider);
        escrow.refundByProvider(id, 0);
        assertEq(usd.balanceOf(client), before + M0);
        // unfunded milestone can be cancelled by the provider with a zero refund
        vm.prank(provider);
        escrow.refundByProvider(id, 1);
        assertEq(uint8(_status(id, 1)), uint8(ZillaEscrow.MilestoneStatus.Refunded));
    }

    function test_terminalStatesAreFinal() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(client);
        escrow.release(id, 0);
        vm.startPrank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.release(id, 0);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.fundMilestone(id, 0);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.openDispute(id, 0);
        vm.stopPrank();
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.refundByProvider(id, 0);
    }

    // ---------------------------------------------------------------- disputes

    function test_dispute_splitByArbiter() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.openDispute(id, 0);
        vm.prank(client);
        escrow.openDispute(id, 0);

        // frozen: no release, no claim, no refund
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.release(id, 0);
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.refundByProvider(id, 0);

        vm.prank(client);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.resolveDispute(id, 0, 0);
        vm.prank(arbiter);
        vm.expectRevert(ZillaEscrow.AmountExceedsEscrow.selector);
        escrow.resolveDispute(id, 0, M0 + 1);

        uint256 clientBefore = usd.balanceOf(client);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, 1_500e6);
        assertEq(usd.balanceOf(provider), 1_500e6);
        assertEq(usd.balanceOf(client), clientBefore + 1_000e6);
        assertEq(usd.balanceOf(address(escrow)), 0);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Resolved));
    }

    function test_dispute_requiresFunds() public {
        uint256 id = _active();
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.openDispute(id, 0);
    }

    function test_dispute_arbiterCanAwardAllEitherWay() public {
        uint256 id = _active();
        _fund(id, 0);
        _fund(id, 1);
        vm.prank(provider);
        escrow.openDispute(id, 0);
        vm.prank(provider);
        escrow.openDispute(id, 1);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0, 0);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1, M1);
        assertEq(usd.balanceOf(provider), M1);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }
}

contract ZillaEscrowChangeOrderTest is Base {
    function test_changeOrder_topUpAndExtend_providerProposes_clientApproves() public {
        uint256 id = _active();
        _fund(id, 1);
        uint64 oldDue = escrow.getMilestone(id, 1).dueDate;
        uint64 newDue = oldDue + 10 days;

        vm.prank(provider);
        uint256 coId = escrow.proposeChangeOrder(id, _co(1, 1_200e6, newDue));
        assertEq(coId, 0);

        // proposer cannot self-approve
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.approveChangeOrder(id, coId);

        vm.expectEmit(true, true, true, true);
        emit ZillaEscrow.ChangeOrderApproved(id, coId, client, 1, oldDue, newDue, 2);
        vm.prank(client);
        escrow.approveChangeOrder(id, coId);

        ZillaEscrow.Agreement memory a = escrow.getAgreement(id);
        assertEq(a.version, 2);
        assertEq(a.scopeHash, SCOPE_V2);
        assertEq(a.baselineHash, SCOPE_V1, "baseline frozen");

        ZillaEscrow.Milestone memory m = escrow.getMilestone(id, 1);
        assertEq(m.amount, M1 + 1_200e6);
        assertEq(m.funded, M1);
        assertEq(m.dueDate, newDue);

        // cannot submit until topped up
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.NotFullyFunded.selector);
        escrow.submitProof(id, 1, PROOF, "");

        _fund(id, 1);
        assertEq(escrow.getMilestone(id, 1).funded, M1 + 1_200e6);
        _submit(id, 1);
        vm.prank(client);
        escrow.release(id, 1);
        assertEq(usd.balanceOf(provider), M1 + 1_200e6);
    }

    function test_changeOrder_reopensSubmittedMilestone() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(client);
        uint256 coId = escrow.proposeChangeOrder(id, _co(0, 500e6, due + 3 days));
        vm.prank(provider);
        escrow.approveChangeOrder(id, coId);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Funded));
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.release(id, 0);
    }

    function test_changeOrder_dateOnlyKeepsSubmission() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(client);
        uint256 coId = escrow.proposeChangeOrder(id, _co(0, 0, due + 3 days));
        vm.prank(provider);
        escrow.approveChangeOrder(id, coId);
        assertEq(uint8(_status(id, 0)), uint8(ZillaEscrow.MilestoneStatus.Submitted));
    }

    function test_changeOrder_appendsNewMilestone() public {
        uint256 id = _active();
        uint64 due = uint64(block.timestamp + 60 days);
        uint32 append = escrow.NEW_MILESTONE();
        vm.prank(client);
        uint256 coId = escrow.proposeChangeOrder(id, _co(append, 800e6, due));
        vm.prank(provider);
        escrow.approveChangeOrder(id, coId);
        ZillaEscrow.Agreement memory a = escrow.getAgreement(id);
        assertEq(a.milestoneCount, 3);
        ZillaEscrow.Milestone memory m = escrow.getMilestone(id, 2);
        assertEq(m.amount, 800e6);
        assertEq(m.dueDate, due);
        assertEq(m.phaseRef, bytes32("CO"));
        _fund(id, 2);
        assertEq(uint8(_status(id, 2)), uint8(ZillaEscrow.MilestoneStatus.Funded));
    }

    function test_changeOrder_validation() public {
        uint256 id = _active();
        uint64 due = escrow.getMilestone(id, 0).dueDate;

        vm.startPrank(provider);
        vm.expectRevert(ZillaEscrow.InvalidDate.selector);
        escrow.proposeChangeOrder(id, _co(0, 1, due - 1));
        vm.expectRevert(ZillaEscrow.NoOp.selector);
        escrow.proposeChangeOrder(id, _co(0, 0, due));
        vm.expectRevert(ZillaEscrow.UnknownMilestone.selector);
        escrow.proposeChangeOrder(id, _co(5, 1, due));
        vm.expectRevert(ZillaEscrow.InvalidAmount.selector);
        escrow.proposeChangeOrder(id, _co(type(uint32).max, 0, due));
        vm.expectRevert(ZillaEscrow.InvalidDate.selector);
        escrow.proposeChangeOrder(id, _co(type(uint32).max, 1, uint64(block.timestamp)));
        ZillaEscrow.ChangeOrderInput memory bad = _co(0, 1, due);
        bad.newScopeHash = bytes32(0);
        vm.expectRevert(ZillaEscrow.InvalidHash.selector);
        escrow.proposeChangeOrder(id, bad);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.proposeChangeOrder(id, _co(0, 1, due));
        vm.prank(agent);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.proposeChangeOrder(id, _co(0, 1, due));
    }

    function test_changeOrder_cannotTargetClosedMilestone() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        vm.prank(client);
        escrow.release(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.proposeChangeOrder(id, _co(0, 1, due));
    }

    function test_changeOrder_staleAfterAnotherApproval() public {
        uint256 id = _active();
        uint64 due = escrow.getMilestone(id, 1).dueDate;
        vm.prank(provider);
        uint256 a0 = escrow.proposeChangeOrder(id, _co(1, 100e6, due + 1 days));
        vm.prank(provider);
        uint256 a1 = escrow.proposeChangeOrder(id, _co(1, 200e6, due + 2 days));
        vm.prank(client);
        escrow.approveChangeOrder(id, a0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.StaleChangeOrder.selector);
        escrow.approveChangeOrder(id, a1);
    }

    function test_changeOrder_revalidatedAtApproval() public {
        uint256 id = _active();
        _fund(id, 0);
        _submit(id, 0);
        uint64 due = escrow.getMilestone(id, 0).dueDate;
        vm.prank(provider);
        uint256 coId = escrow.proposeChangeOrder(id, _co(0, 100e6, due + 1 days));
        vm.prank(client);
        escrow.release(id, 0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongMilestoneStatus.selector);
        escrow.approveChangeOrder(id, coId);
    }

    function test_changeOrder_declineAndCancel() public {
        uint256 id = _active();
        uint64 due = escrow.getMilestone(id, 1).dueDate;
        vm.prank(provider);
        uint256 c0 = escrow.proposeChangeOrder(id, _co(1, 100e6, due));
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.declineChangeOrder(id, c0);
        vm.prank(client);
        escrow.declineChangeOrder(id, c0);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.WrongChangeOrderStatus.selector);
        escrow.approveChangeOrder(id, c0);

        vm.prank(client);
        uint256 c1 = escrow.proposeChangeOrder(id, _co(1, 100e6, due));
        vm.prank(provider);
        vm.expectRevert(ZillaEscrow.NotAuthorized.selector);
        escrow.cancelChangeOrder(id, c1);
        vm.prank(client);
        escrow.cancelChangeOrder(id, c1);
        assertEq(
            uint8(escrow.getChangeOrder(id, c1).status),
            uint8(ZillaEscrow.ChangeOrderStatus.Cancelled)
        );
        assertEq(escrow.getAgreement(id).version, 1);
    }
}

contract ZillaEscrowTokenSafetyTest is Base {
    function test_rejectsFeeOnTransferToken() public {
        FeeToken fee = new FeeToken();
        fee.mint(client, 1_000_000e6);
        vm.prank(client);
        fee.approve(address(escrow), type(uint256).max);
        vm.prank(provider);
        uint256 id = escrow.createAgreement(_input(IERC20(address(fee))));
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1);
        vm.prank(client);
        vm.expectRevert(ZillaEscrow.UnsupportedToken.selector);
        escrow.fundMilestone(id, 0);
    }

    function test_mockFaucetLimit() public {
        vm.expectRevert(MockStablecoin.FaucetLimit.selector);
        usd.mint(stranger, 1_000_001e6);
        assertEq(usd.decimals(), 6);
    }
}
