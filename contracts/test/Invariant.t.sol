// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZillaEscrow} from "../src/ZillaEscrow.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";

/// Drives random sequences of every escrow action across a few agreements.
contract Handler is Test {
    ZillaEscrow public escrow;
    MockStablecoin public usd;
    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public arbiter = makeAddr("arbiter");
    bytes32 public constant BASE = keccak256("base");
    uint256[] public ids;
    uint256 public paidOut;

    constructor(ZillaEscrow e, MockStablecoin t) {
        escrow = e;
        usd = t;
        usd.mint(client, 1_000_000e6);
        vm.prank(client);
        usd.approve(address(escrow), type(uint256).max);
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    function create(uint128 a0, uint128 a1) external {
        if (ids.length >= 4) return;
        ZillaEscrow.MilestoneInput[] memory ms = new ZillaEscrow.MilestoneInput[](2);
        ms[0] = ZillaEscrow.MilestoneInput(
            uint128(bound(a0, 1, 5_000e6)), uint64(block.timestamp + 10 days), "P1"
        );
        ms[1] = ZillaEscrow.MilestoneInput(
            uint128(bound(a1, 1, 5_000e6)), uint64(block.timestamp + 20 days), "P2"
        );
        ZillaEscrow.AgreementInput memory input = ZillaEscrow.AgreementInput(
            client, provider, address(0), arbiter, IERC20(address(usd)), BASE, "", ms
        );
        vm.prank(provider);
        uint256 id = escrow.createAgreement(input);
        vm.prank(client);
        escrow.acceptAgreement(id, BASE, address(0));
        ids.push(id);
    }

    function _pick(uint256 seed) internal view returns (uint256 id, uint256 idx, bool ok) {
        if (ids.length == 0) return (0, 0, false);
        id = ids[seed % ids.length];
        idx = (seed >> 8) % escrow.getAgreement(id).milestoneCount;
        ok = true;
    }

    function fund(uint256 seed) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(client);
        try escrow.fundMilestone(id, i) {} catch {}
    }

    function submit(uint256 seed) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(provider);
        try escrow.submitProof(id, i, keccak256(abi.encode(seed)), "") {} catch {}
    }

    function release(uint256 seed) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(client);
        try escrow.release(id, i) {} catch {}
    }

    function refund(uint256 seed) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(provider);
        try escrow.refundByProvider(id, i) {} catch {}
    }

    function dispute(uint256 seed, uint128 split) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(client);
        try escrow.openDispute(id, i) {} catch {}
        uint128 held = escrow.getMilestone(id, i).funded;
        vm.prank(arbiter);
        try escrow.resolveDispute(id, i, uint128(bound(split, 0, held))) {} catch {}
    }

    /// Dispute left for the arbiter to ignore, then settled by timeout once the clock allows.
    function disputeTimeout(uint256 seed, bool openOnly) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(provider);
        try escrow.openDispute(id, i) {} catch {}
        if (openOnly) return;
        vm.prank(client);
        try escrow.resolveDisputeAfterTimeout(id, i) {} catch {}
    }

    function changeOrder(uint256 seed, uint128 delta, uint32 extend, bool append) external {
        (uint256 id, uint256 i, bool ok) = _pick(seed);
        if (!ok) return;
        uint64 due = escrow.getMilestone(id, i).dueDate;
        ZillaEscrow.ChangeOrderInput memory co = ZillaEscrow.ChangeOrderInput({
            target: append ? type(uint32).max : uint32(i),
            costDelta: uint128(bound(delta, append ? 1 : 0, 2_000e6)),
            newDueDate: append
                ? uint64(block.timestamp + 30 days)
                : due + uint64(bound(extend, 1, 30 days)),
            phaseRef: "CO",
            newScopeHash: keccak256(abi.encode(seed, delta)),
            reasonURI: ""
        });
        vm.prank(provider);
        try escrow.proposeChangeOrder(id, co) returns (uint256 coId) {
            vm.prank(client);
            try escrow.approveChangeOrder(id, coId) {} catch {}
        } catch {}
    }

    function warp(uint32 by) external {
        vm.warp(block.timestamp + bound(by, 0, 20 days));
    }
}

contract ZillaEscrowInvariantTest is Test {
    ZillaEscrow escrow;
    MockStablecoin usd;
    Handler handler;

    function setUp() public {
        escrow = new ZillaEscrow();
        usd = new MockStablecoin();
        handler = new Handler(escrow, usd);
        targetContract(address(handler));
    }

    /// Escrow balance always equals the accounted total and the sum of funded milestones.
    function invariant_balanceMatchesAccounting() public view {
        uint256 sum;
        for (uint256 k; k < handler.idCount(); ++k) {
            uint256 id = handler.ids(k);
            ZillaEscrow.Milestone[] memory ms = escrow.getMilestones(id);
            for (uint256 i; i < ms.length; ++i) {
                sum += ms[i].funded;
            }
        }
        assertEq(usd.balanceOf(address(escrow)), escrow.escrowed(IERC20(address(usd))));
        assertEq(usd.balanceOf(address(escrow)), sum);
    }

    /// No milestone ever holds more than it is owed; terminal milestones hold nothing.
    function invariant_fundedBounded() public view {
        for (uint256 k; k < handler.idCount(); ++k) {
            ZillaEscrow.Milestone[] memory ms = escrow.getMilestones(handler.ids(k));
            for (uint256 i; i < ms.length; ++i) {
                assertLe(ms[i].funded, ms[i].amount);
                ZillaEscrow.MilestoneStatus s = ms[i].status;
                if (
                    s == ZillaEscrow.MilestoneStatus.Released
                        || s == ZillaEscrow.MilestoneStatus.Refunded
                        || s == ZillaEscrow.MilestoneStatus.Resolved
                ) assertEq(ms[i].funded, 0);
            }
        }
    }

    /// The signed baseline never changes after acceptance.
    function invariant_baselineFrozen() public view {
        for (uint256 k; k < handler.idCount(); ++k) {
            assertEq(escrow.getAgreement(handler.ids(k)).baselineHash, handler.BASE());
        }
    }

    /// Value is conserved: client start balance = client + provider + escrow.
    function invariant_conservation() public view {
        assertEq(
            usd.balanceOf(handler.client()) + usd.balanceOf(handler.provider())
                + usd.balanceOf(address(escrow)),
            1_000_000e6
        );
    }
}
