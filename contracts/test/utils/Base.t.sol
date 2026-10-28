// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZillaEscrow} from "../../src/ZillaEscrow.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";

abstract contract Base is Test {
    ZillaEscrow internal escrow;
    MockStablecoin internal usd;

    address internal client = makeAddr("client");
    address internal provider = makeAddr("provider");
    address internal agent = makeAddr("agent");
    address internal arbiter = makeAddr("arbiter");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant SCOPE_V1 = keccak256("synthetic-scope-v1");
    bytes32 internal constant SCOPE_V2 = keccak256("synthetic-scope-v2");
    bytes32 internal constant PROOF = keccak256("delivery-pack");

    uint128 internal constant M0 = 2_500e6;
    uint128 internal constant M1 = 4_000e6;

    function setUp() public virtual {
        vm.warp(1_767_225_600); // 2026-01-01
        escrow = new ZillaEscrow();
        usd = new MockStablecoin();
        usd.mint(client, 1_000_000e6);
        vm.prank(client);
        usd.approve(address(escrow), type(uint256).max);
    }

    function _input(IERC20 token) internal view returns (ZillaEscrow.AgreementInput memory input) {
        ZillaEscrow.MilestoneInput[] memory ms = new ZillaEscrow.MilestoneInput[](2);
        ms[0] = ZillaEscrow.MilestoneInput({
            amount: M0, dueDate: uint64(block.timestamp + 14 days), phaseRef: "P1"
        });
        ms[1] = ZillaEscrow.MilestoneInput({
            amount: M1, dueDate: uint64(block.timestamp + 42 days), phaseRef: "P2"
        });
        input = ZillaEscrow.AgreementInput({
            client: client,
            provider: provider,
            agent: agent,
            arbiter: arbiter,
            token: token,
            scopeHash: SCOPE_V1,
            scopeURI: "ipfs://synthetic-scope",
            milestones: ms
        });
    }

    /// Provider proposes, client accepts. Returns an Active agreement id.
    function _active() internal returns (uint256 id) {
        vm.prank(provider);
        id = escrow.createAgreement(_input(IERC20(address(usd))));
        vm.prank(client);
        escrow.acceptAgreement(id, SCOPE_V1, agent);
    }

    function _fund(uint256 id, uint256 i) internal {
        vm.prank(client);
        escrow.fundMilestone(id, i);
    }

    function _submit(uint256 id, uint256 i) internal {
        vm.prank(agent);
        escrow.submitProof(id, i, PROOF, "ipfs://proof");
    }

    function _co(uint32 target, uint128 delta, uint64 due)
        internal
        pure
        returns (ZillaEscrow.ChangeOrderInput memory)
    {
        return ZillaEscrow.ChangeOrderInput({
            target: target,
            costDelta: delta,
            newDueDate: due,
            phaseRef: "CO",
            newScopeHash: SCOPE_V2,
            reasonURI: "ipfs://co"
        });
    }

    function _status(uint256 id, uint256 i) internal view returns (ZillaEscrow.MilestoneStatus) {
        return escrow.getMilestone(id, i).status;
    }
}
