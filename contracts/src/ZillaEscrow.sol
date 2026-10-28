// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZillaEscrow
/// @author Zilla Labs
/// @notice Milestone escrow for service work. A client funds each milestone in an ERC-20
///         stablecoin, the provider (or its delivery agent) posts proof of delivery, and the
///         client releases with one call. Change orders add funds and extend dates only when
///         both parties approve. A neutral arbiter settles disputes. Every transition emits an
///         event, so the full history can be rebuilt from logs.
/// @dev    Mirrors the UDG Desk scope model: the signed baseline is frozen as `baselineHash`,
///         and each approved change order bumps `version` and `scopeHash` without touching the
///         baseline. Non-custodial: there is no owner, no admin withdraw and no upgrade path.
///         TESTNET DEMO. Not audited. Do not use with real funds.
contract ZillaEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ constants

    /// @notice Sentinel `target` meaning "append a new milestone" in a change order.
    uint32 public constant NEW_MILESTONE = type(uint32).max;
    /// @notice Hard cap on milestones per agreement, keeps loops in views bounded.
    uint256 public constant MAX_MILESTONES = 64;
    /// @notice After proof is posted, the provider may claim if the client stays silent this long.
    uint64 public constant REVIEW_PERIOD = 14 days;
    /// @notice A funded but undelivered milestone becomes refundable this long after its due date.
    uint64 public constant REFUND_GRACE = 7 days;
    /// @notice If the arbiter has not ruled this long after a dispute opens, either party may
    ///         settle it with the default split (see `resolveDisputeAfterTimeout`).
    uint64 public constant ARBITER_TIMEOUT = 30 days;

    // ------------------------------------------------------------------ types

    enum AgreementStatus {
        None,
        Proposed,
        Active,
        Cancelled
    }

    enum MilestoneStatus {
        Pending, // agreed, not fully funded
        Funded, // fully funded, awaiting delivery
        Submitted, // proof of delivery posted, awaiting client release
        Released, // paid to provider (terminal)
        Refunded, // returned to client (terminal)
        Disputed, // frozen, awaiting arbiter
        Resolved // arbiter split paid out (terminal)
    }

    enum ChangeOrderStatus {
        None,
        Proposed,
        Approved,
        Declined,
        Cancelled
    }

    struct Agreement {
        address client;
        address provider;
        address agent;
        address arbiter;
        IERC20 token;
        address creator;
        AgreementStatus status;
        uint32 version;
        uint32 milestoneCount;
        uint32 changeOrderCount;
        uint64 acceptedAt;
        bytes32 baselineHash;
        bytes32 scopeHash;
        string scopeURI;
    }

    struct Milestone {
        uint128 amount;
        uint128 funded;
        uint64 dueDate;
        uint64 submittedAt;
        MilestoneStatus status;
        bytes32 phaseRef;
        bytes32 proofHash;
        string proofURI;
    }

    struct ChangeOrder {
        address proposer;
        uint32 target;
        uint32 baseVersion;
        ChangeOrderStatus status;
        uint128 costDelta;
        uint64 newDueDate;
        bytes32 phaseRef;
        bytes32 newScopeHash;
        string reasonURI;
    }

    struct MilestoneInput {
        uint128 amount;
        uint64 dueDate;
        bytes32 phaseRef;
    }

    struct AgreementInput {
        address client;
        address provider;
        address agent;
        address arbiter;
        IERC20 token;
        bytes32 scopeHash;
        string scopeURI;
        MilestoneInput[] milestones;
    }

    struct ChangeOrderInput {
        uint32 target;
        uint128 costDelta;
        uint64 newDueDate;
        bytes32 phaseRef;
        bytes32 newScopeHash;
        string reasonURI;
    }

    // ------------------------------------------------------------------ storage

    uint256 public agreementCount;
    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => mapping(uint256 => Milestone)) private _milestones;
    mapping(uint256 => mapping(uint256 => ChangeOrder)) private _changeOrders;
    /// @notice Total tokens currently held in escrow per token, across all agreements.
    mapping(IERC20 => uint256) public escrowed;
    /// @notice When each milestone's current dispute was opened (0 if never disputed).
    mapping(uint256 => mapping(uint256 => uint64)) public disputedAt;
    /// @notice Agent the provider proposed after acceptance, waiting for client consent.
    mapping(uint256 => address) public pendingAgent;
    mapping(uint256 => uint256) public pendingAgentIdentity;

    // ------------------------------------------------------------------ events

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed client,
        address indexed provider,
        address creator,
        address arbiter,
        address token,
        bytes32 scopeHash,
        string scopeURI
    );
    event MilestoneAdded(
        uint256 indexed agreementId,
        uint256 indexed index,
        uint128 amount,
        uint64 dueDate,
        bytes32 phaseRef
    );
    event AgreementAccepted(uint256 indexed agreementId, address indexed by, bytes32 baselineHash);
    event AgreementCancelled(uint256 indexed agreementId, address indexed by);
    event AgentSet(uint256 indexed agreementId, address indexed agent, uint256 agentIdentityId);
    event AgentProposed(
        uint256 indexed agreementId, address indexed agent, uint256 agentIdentityId
    );
    event MilestoneFunded(
        uint256 indexed agreementId,
        uint256 indexed index,
        address indexed from,
        uint128 amount,
        uint128 fundedTotal
    );
    event ProofSubmitted(
        uint256 indexed agreementId,
        uint256 indexed index,
        address indexed by,
        bytes32 proofHash,
        string proofURI
    );
    event MilestoneReleased(
        uint256 indexed agreementId, uint256 indexed index, address indexed by, uint128 amount
    );
    event MilestoneRefunded(
        uint256 indexed agreementId, uint256 indexed index, address indexed by, uint128 amount
    );
    event DisputeOpened(uint256 indexed agreementId, uint256 indexed index, address indexed by);
    event DisputeResolved(
        uint256 indexed agreementId,
        uint256 indexed index,
        address indexed arbiter,
        uint128 toProvider,
        uint128 toClient
    );
    event ChangeOrderProposed(
        uint256 indexed agreementId,
        uint256 indexed changeOrderId,
        address indexed proposer,
        uint32 target,
        uint128 costDelta,
        uint64 newDueDate,
        bytes32 newScopeHash,
        string reasonURI
    );
    event ChangeOrderApproved(
        uint256 indexed agreementId,
        uint256 indexed changeOrderId,
        address indexed approver,
        uint32 milestoneIndex,
        uint64 previousDueDate,
        uint64 newDueDate,
        uint32 newVersion
    );
    event ChangeOrderDeclined(
        uint256 indexed agreementId, uint256 indexed changeOrderId, address indexed by
    );
    event ChangeOrderCancelled(
        uint256 indexed agreementId, uint256 indexed changeOrderId, address indexed by
    );

    // ------------------------------------------------------------------ errors

    error InvalidAddress();
    error InvalidRoles();
    error InvalidAmount();
    error InvalidDate();
    error InvalidHash();
    error TooManyMilestones();
    error NotParty();
    error NotAuthorized();
    error WrongAgreementStatus();
    error WrongMilestoneStatus();
    error WrongChangeOrderStatus();
    error UnknownMilestone();
    error UnknownChangeOrder();
    error HashMismatch();
    error AgentMismatch();
    error NotFullyFunded();
    error NothingToFund();
    error TooEarly();
    error StaleChangeOrder();
    error NoOp();
    error AmountExceedsEscrow();
    error UnsupportedToken();

    // ------------------------------------------------------------------ agreement lifecycle

    /// @notice Propose an agreement. Caller must be the client or the provider; the other party
    ///         accepts it with `acceptAgreement`, which freezes the signed baseline.
    function createAgreement(AgreementInput calldata input) external returns (uint256 agreementId) {
        if (
            input.client == address(0) || input.provider == address(0)
                || address(input.token) == address(0)
        ) {
            revert InvalidAddress();
        }
        if (input.arbiter == address(0)) revert InvalidAddress();
        if (
            input.client == input.provider || input.arbiter == input.client
                || input.arbiter == input.provider || input.agent == input.client
                || input.agent == input.arbiter
        ) revert InvalidRoles();
        if (msg.sender != input.client && msg.sender != input.provider) revert NotParty();
        if (input.scopeHash == bytes32(0)) revert InvalidHash();
        uint256 n = input.milestones.length;
        if (n == 0) revert InvalidAmount();
        if (n > MAX_MILESTONES) revert TooManyMilestones();

        agreementId = ++agreementCount;
        Agreement storage a = _agreements[agreementId];
        a.client = input.client;
        a.provider = input.provider;
        a.agent = input.agent;
        a.arbiter = input.arbiter;
        a.token = input.token;
        a.creator = msg.sender;
        a.status = AgreementStatus.Proposed;
        a.scopeHash = input.scopeHash;
        a.scopeURI = input.scopeURI;
        a.milestoneCount = uint32(n);

        emit AgreementCreated(
            agreementId,
            input.client,
            input.provider,
            msg.sender,
            input.arbiter,
            address(input.token),
            input.scopeHash,
            input.scopeURI
        );

        for (uint256 i; i < n; ++i) {
            MilestoneInput calldata m = input.milestones[i];
            if (m.amount == 0) revert InvalidAmount();
            if (m.dueDate <= block.timestamp) revert InvalidDate();
            Milestone storage s = _milestones[agreementId][i];
            s.amount = m.amount;
            s.dueDate = m.dueDate;
            s.phaseRef = m.phaseRef;
            emit MilestoneAdded(agreementId, i, m.amount, m.dueDate, m.phaseRef);
        }
        if (input.agent != address(0)) emit AgentSet(agreementId, input.agent, 0);
    }

    /// @notice Counterparty acceptance. `scopeHash` must equal the proposed hash, proving the
    ///         signer saw the exact scope. The hash is frozen as the signed baseline (version 1).
    ///         `expectedAgent` must equal the delivery agent on the agreement (address(0) for
    ///         none), so an agent swapped in by the provider before acceptance cannot be accepted
    ///         unseen.
    function acceptAgreement(uint256 agreementId, bytes32 scopeHash, address expectedAgent)
        external
    {
        Agreement storage a = _agreement(agreementId);
        if (a.status != AgreementStatus.Proposed) revert WrongAgreementStatus();
        if (!_isParty(a, msg.sender) || msg.sender == a.creator) revert NotAuthorized();
        if (scopeHash != a.scopeHash) revert HashMismatch();
        if (expectedAgent != a.agent) revert AgentMismatch();
        a.status = AgreementStatus.Active;
        a.baselineHash = scopeHash;
        a.version = 1;
        a.acceptedAt = uint64(block.timestamp);
        emit AgreementAccepted(agreementId, msg.sender, scopeHash);
    }

    /// @notice The creator may withdraw a proposal before it is accepted. Nothing is escrowed yet.
    function cancelAgreement(uint256 agreementId) external {
        Agreement storage a = _agreement(agreementId);
        if (a.status != AgreementStatus.Proposed) revert WrongAgreementStatus();
        if (msg.sender != a.creator) revert NotAuthorized();
        a.status = AgreementStatus.Cancelled;
        emit AgreementCancelled(agreementId, msg.sender);
    }

    /// @notice Provider assigns (or clears) the delivery agent allowed to post proofs. Before
    ///         acceptance, or when clearing the agent, it takes effect at once. After acceptance a
    ///         new agent is only proposed: the client must consent with `approveAgent`, because an
    ///         agent's proof starts the provider's claim clock.
    /// @param agentIdentityId Optional ERC-8004 identity registry id for the agent, 0 if none.
    function setAgent(uint256 agreementId, address agent, uint256 agentIdentityId) external {
        Agreement storage a = _agreement(agreementId);
        if (msg.sender != a.provider) revert NotAuthorized();
        if (a.status == AgreementStatus.Cancelled) revert WrongAgreementStatus();
        if (agent == a.client || agent == a.arbiter) revert InvalidRoles();
        delete pendingAgent[agreementId];
        delete pendingAgentIdentity[agreementId];
        if (a.status == AgreementStatus.Proposed || agent == address(0)) {
            a.agent = agent;
            emit AgentSet(agreementId, agent, agentIdentityId);
        } else {
            pendingAgent[agreementId] = agent;
            pendingAgentIdentity[agreementId] = agentIdentityId;
            emit AgentProposed(agreementId, agent, agentIdentityId);
        }
    }

    /// @notice Client consents to the agent the provider proposed after acceptance. `agent` must
    ///         match the pending proposal, so a swapped proposal cannot be approved by accident.
    function approveAgent(uint256 agreementId, address agent) external {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client) revert NotAuthorized();
        address pending = pendingAgent[agreementId];
        if (pending == address(0) || pending != agent) revert InvalidAddress();
        uint256 identityId = pendingAgentIdentity[agreementId];
        delete pendingAgent[agreementId];
        delete pendingAgentIdentity[agreementId];
        a.agent = agent;
        emit AgentSet(agreementId, agent, identityId);
    }

    // ------------------------------------------------------------------ milestone lifecycle

    /// @notice Client funds whatever is still owed on a milestone (full amount, or a change-order
    ///         top-up). Fee-on-transfer and rebasing tokens are rejected.
    function fundMilestone(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        MilestoneStatus st = m.status;
        if (
            st != MilestoneStatus.Pending && st != MilestoneStatus.Funded
                && st != MilestoneStatus.Submitted
        ) {
            revert WrongMilestoneStatus();
        }
        uint128 owed = m.amount - m.funded;
        if (owed == 0) revert NothingToFund();

        m.funded = m.amount;
        if (st == MilestoneStatus.Pending) m.status = MilestoneStatus.Funded;
        escrowed[a.token] += owed;

        IERC20 token = a.token;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), owed);
        if (token.balanceOf(address(this)) - before != owed) revert UnsupportedToken();

        emit MilestoneFunded(agreementId, index, msg.sender, owed, m.funded);
    }

    /// @notice Provider or its agent posts proof of delivery: a content hash of the delivery
    ///         pack plus a URI where the client can review it. Resubmitting replaces the proof.
    ///         Proof may also be posted while the milestone is Disputed, so an early dispute
    ///         cannot block delivery; the milestone stays Disputed for the arbiter.
    function submitProof(
        uint256 agreementId,
        uint256 index,
        bytes32 proofHash,
        string calldata proofURI
    ) external {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.provider && (msg.sender != a.agent || a.agent == address(0))) {
            revert NotAuthorized();
        }
        Milestone storage m = _milestone(a, agreementId, index);
        MilestoneStatus st = m.status;
        if (
            st != MilestoneStatus.Funded && st != MilestoneStatus.Submitted
                && st != MilestoneStatus.Disputed
        ) {
            revert WrongMilestoneStatus();
        }
        if (m.funded != m.amount) revert NotFullyFunded();
        if (proofHash == bytes32(0)) revert InvalidHash();
        if (st != MilestoneStatus.Disputed) m.status = MilestoneStatus.Submitted;
        m.proofHash = proofHash;
        m.proofURI = proofURI;
        m.submittedAt = uint64(block.timestamp);
        emit ProofSubmitted(agreementId, index, msg.sender, proofHash, proofURI);
    }

    /// @notice Client one-click release of a delivered milestone to the provider.
    function release(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client) revert NotAuthorized();
        _payProvider(a, agreementId, index);
    }

    /// @notice Provider claims a delivered milestone after the client stays silent for
    ///         REVIEW_PERIOD. Protects the provider from a client who never responds.
    function claimAfterReview(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.provider) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        if (
            m.status == MilestoneStatus.Submitted
                && block.timestamp < uint256(m.submittedAt) + REVIEW_PERIOD
        ) {
            revert TooEarly();
        }
        _payProvider(a, agreementId, index);
    }

    /// @notice Client reclaims a milestone that was never delivered, once it is REFUND_GRACE
    ///         past its due date. Once any proof has been posted (including a milestone reopened
    ///         by a cost-raising change order), expiry no longer applies: settle by release,
    ///         dispute or a voluntary provider refund instead.
    function refundExpired(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        if (m.status != MilestoneStatus.Pending && m.status != MilestoneStatus.Funded) {
            revert WrongMilestoneStatus();
        }
        if (m.proofHash != bytes32(0)) revert WrongMilestoneStatus();
        if (block.timestamp <= uint256(m.dueDate) + REFUND_GRACE) revert TooEarly();
        _refund(a, m, agreementId, index);
    }

    /// @notice Provider voluntarily returns a milestone to the client (mutual cancel path).
    function refundByProvider(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.provider) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        MilestoneStatus st = m.status;
        if (
            st != MilestoneStatus.Pending && st != MilestoneStatus.Funded
                && st != MilestoneStatus.Submitted
        ) {
            revert WrongMilestoneStatus();
        }
        _refund(a, m, agreementId, index);
    }

    /// @notice Either party freezes a funded milestone for the arbiter.
    function openDispute(uint256 agreementId, uint256 index) external {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client && msg.sender != a.provider) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        if (m.status != MilestoneStatus.Funded && m.status != MilestoneStatus.Submitted) {
            revert WrongMilestoneStatus();
        }
        m.status = MilestoneStatus.Disputed;
        disputedAt[agreementId][index] = uint64(block.timestamp);
        emit DisputeOpened(agreementId, index, msg.sender);
    }

    /// @notice Arbiter splits the escrowed amount: `toProvider` to the provider, the rest back
    ///         to the client.
    function resolveDispute(uint256 agreementId, uint256 index, uint128 toProvider)
        external
        nonReentrant
    {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.arbiter) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        if (m.status != MilestoneStatus.Disputed) revert WrongMilestoneStatus();
        if (toProvider > m.funded) revert AmountExceedsEscrow();
        _settleDispute(a, m, agreementId, index, toProvider, msg.sender);
    }

    /// @notice Exit for a dispute the arbiter never rules on. After ARBITER_TIMEOUT either party
    ///         may settle with the default split: if proof was posted, the held funds are split
    ///         evenly (odd unit to the client); if no proof was ever posted, all of it returns to
    ///         the client, but only once the milestone is also REFUND_GRACE past its due date, so
    ///         an early dispute cannot claw back work that was not yet due. Emits
    ///         `DisputeResolved` with `arbiter == address(0)`.
    /// @dev    Known edge case, by design: the contract only checks that a proof hash exists,
    ///         not that the work is good. With an absent arbiter, a provider can post junk proof
    ///         during a dispute and turn a full no-proof refund into the 50/50 default. This
    ///         mirrors the client's power to dispute and is no worse than junk proof posted
    ///         before a dispute. Judging proof quality is the arbiter's job, so pick an active one.
    function resolveDisputeAfterTimeout(uint256 agreementId, uint256 index) external nonReentrant {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client && msg.sender != a.provider) revert NotAuthorized();
        Milestone storage m = _milestone(a, agreementId, index);
        if (m.status != MilestoneStatus.Disputed) revert WrongMilestoneStatus();
        if (block.timestamp < uint256(disputedAt[agreementId][index]) + ARBITER_TIMEOUT) {
            revert TooEarly();
        }
        bool delivered = m.proofHash != bytes32(0);
        if (!delivered && block.timestamp <= uint256(m.dueDate) + REFUND_GRACE) revert TooEarly();
        uint128 toProvider = delivered ? m.funded / 2 : 0;
        _settleDispute(a, m, agreementId, index, toProvider, address(0));
    }

    // ------------------------------------------------------------------ change orders

    /// @notice Either party proposes a change: add cost and/or extend the due date of an open
    ///         milestone, or append a new milestone (`target == NEW_MILESTONE`). It takes effect
    ///         only when the other party approves. `newScopeHash` is the hash of the amended scope.
    function proposeChangeOrder(uint256 agreementId, ChangeOrderInput calldata input)
        external
        returns (uint256 changeOrderId)
    {
        Agreement storage a = _activeAgreement(agreementId);
        if (msg.sender != a.client && msg.sender != a.provider) revert NotAuthorized();
        if (input.newScopeHash == bytes32(0)) revert InvalidHash();
        _validateChange(a, agreementId, input.target, input.costDelta, input.newDueDate);

        changeOrderId = a.changeOrderCount++;
        ChangeOrder storage co = _changeOrders[agreementId][changeOrderId];
        co.proposer = msg.sender;
        co.target = input.target;
        co.baseVersion = a.version;
        co.status = ChangeOrderStatus.Proposed;
        co.costDelta = input.costDelta;
        co.newDueDate = input.newDueDate;
        co.phaseRef = input.phaseRef;
        co.newScopeHash = input.newScopeHash;
        co.reasonURI = input.reasonURI;

        emit ChangeOrderProposed(
            agreementId,
            changeOrderId,
            msg.sender,
            input.target,
            input.costDelta,
            input.newDueDate,
            input.newScopeHash,
            input.reasonURI
        );
    }

    /// @notice The counterparty approves. The amended scope becomes the new version; the signed
    ///         baseline is untouched. Any added cost is then funded by the client with
    ///         `fundMilestone`. A submitted milestone whose cost grows reopens for new proof.
    function approveChangeOrder(uint256 agreementId, uint256 changeOrderId) external {
        Agreement storage a = _activeAgreement(agreementId);
        ChangeOrder storage co = _changeOrder(a, agreementId, changeOrderId);
        if (co.status != ChangeOrderStatus.Proposed) revert WrongChangeOrderStatus();
        if (!_isParty(a, msg.sender) || msg.sender == co.proposer) revert NotAuthorized();
        if (co.baseVersion != a.version) revert StaleChangeOrder();
        _validateChange(a, agreementId, co.target, co.costDelta, co.newDueDate);

        co.status = ChangeOrderStatus.Approved;
        uint32 newVersion = ++a.version;
        a.scopeHash = co.newScopeHash;

        uint32 index;
        uint64 previousDue;
        if (co.target == NEW_MILESTONE) {
            index = a.milestoneCount++;
            Milestone storage nm = _milestones[agreementId][index];
            nm.amount = co.costDelta;
            nm.dueDate = co.newDueDate;
            nm.phaseRef = co.phaseRef;
            emit MilestoneAdded(agreementId, index, co.costDelta, co.newDueDate, co.phaseRef);
        } else {
            index = co.target;
            Milestone storage m = _milestones[agreementId][index];
            previousDue = m.dueDate;
            m.amount += co.costDelta;
            m.dueDate = co.newDueDate;
            if (co.costDelta != 0 && m.status == MilestoneStatus.Submitted) {
                m.status = MilestoneStatus.Funded;
            }
        }
        emit ChangeOrderApproved(
            agreementId, changeOrderId, msg.sender, index, previousDue, co.newDueDate, newVersion
        );
    }

    /// @notice The counterparty declines a proposed change order.
    function declineChangeOrder(uint256 agreementId, uint256 changeOrderId) external {
        Agreement storage a = _activeAgreement(agreementId);
        ChangeOrder storage co = _changeOrder(a, agreementId, changeOrderId);
        if (co.status != ChangeOrderStatus.Proposed) revert WrongChangeOrderStatus();
        if (!_isParty(a, msg.sender) || msg.sender == co.proposer) revert NotAuthorized();
        co.status = ChangeOrderStatus.Declined;
        emit ChangeOrderDeclined(agreementId, changeOrderId, msg.sender);
    }

    /// @notice The proposer withdraws a change order before it is answered.
    function cancelChangeOrder(uint256 agreementId, uint256 changeOrderId) external {
        Agreement storage a = _activeAgreement(agreementId);
        ChangeOrder storage co = _changeOrder(a, agreementId, changeOrderId);
        if (co.status != ChangeOrderStatus.Proposed) revert WrongChangeOrderStatus();
        if (msg.sender != co.proposer) revert NotAuthorized();
        co.status = ChangeOrderStatus.Cancelled;
        emit ChangeOrderCancelled(agreementId, changeOrderId, msg.sender);
    }

    // ------------------------------------------------------------------ views

    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return _agreement(agreementId);
    }

    function getMilestone(uint256 agreementId, uint256 index)
        external
        view
        returns (Milestone memory)
    {
        Agreement storage a = _agreement(agreementId);
        return _milestone(a, agreementId, index);
    }

    function getMilestones(uint256 agreementId) external view returns (Milestone[] memory list) {
        Agreement storage a = _agreement(agreementId);
        uint256 n = a.milestoneCount;
        list = new Milestone[](n);
        for (uint256 i; i < n; ++i) {
            list[i] = _milestones[agreementId][i];
        }
    }

    function getChangeOrder(uint256 agreementId, uint256 changeOrderId)
        external
        view
        returns (ChangeOrder memory)
    {
        Agreement storage a = _agreement(agreementId);
        return _changeOrder(a, agreementId, changeOrderId);
    }

    // ------------------------------------------------------------------ internals

    function _payProvider(Agreement storage a, uint256 agreementId, uint256 index) private {
        Milestone storage m = _milestone(a, agreementId, index);
        // Submitted implies fully funded: proof needs full funding, and a cost increase on a
        // Submitted milestone moves it back to Funded.
        if (m.status != MilestoneStatus.Submitted) revert WrongMilestoneStatus();
        uint128 amount = m.funded;
        m.status = MilestoneStatus.Released;
        m.funded = 0;
        escrowed[a.token] -= amount;
        a.token.safeTransfer(a.provider, amount);
        emit MilestoneReleased(agreementId, index, msg.sender, amount);
    }

    function _settleDispute(
        Agreement storage a,
        Milestone storage m,
        uint256 agreementId,
        uint256 index,
        uint128 toProvider,
        address by
    ) private {
        uint128 held = m.funded;
        uint128 toClient = held - toProvider;
        m.status = MilestoneStatus.Resolved;
        m.funded = 0;
        escrowed[a.token] -= held;
        if (toProvider != 0) a.token.safeTransfer(a.provider, toProvider);
        if (toClient != 0) a.token.safeTransfer(a.client, toClient);
        emit DisputeResolved(agreementId, index, by, toProvider, toClient);
    }

    function _refund(Agreement storage a, Milestone storage m, uint256 agreementId, uint256 index)
        private
    {
        uint128 amount = m.funded;
        m.status = MilestoneStatus.Refunded;
        m.funded = 0;
        if (amount != 0) {
            escrowed[a.token] -= amount;
            a.token.safeTransfer(a.client, amount);
        }
        emit MilestoneRefunded(agreementId, index, msg.sender, amount);
    }

    function _validateChange(
        Agreement storage a,
        uint256 agreementId,
        uint32 target,
        uint128 costDelta,
        uint64 newDueDate
    ) private view {
        if (target == NEW_MILESTONE) {
            if (costDelta == 0) revert InvalidAmount();
            if (newDueDate <= block.timestamp) revert InvalidDate();
            if (a.milestoneCount >= MAX_MILESTONES) revert TooManyMilestones();
        } else {
            Milestone storage m = _milestone(a, agreementId, target);
            MilestoneStatus st = m.status;
            if (
                st != MilestoneStatus.Pending && st != MilestoneStatus.Funded
                    && st != MilestoneStatus.Submitted
            ) {
                revert WrongMilestoneStatus();
            }
            if (newDueDate < m.dueDate) revert InvalidDate();
            if (costDelta == 0 && newDueDate == m.dueDate) revert NoOp();
            if (uint256(m.amount) + costDelta > type(uint128).max) revert InvalidAmount();
        }
    }

    function _isParty(Agreement storage a, address who) private view returns (bool) {
        return who == a.client || who == a.provider;
    }

    function _agreement(uint256 agreementId) private view returns (Agreement storage a) {
        a = _agreements[agreementId];
        if (a.status == AgreementStatus.None) revert WrongAgreementStatus();
    }

    function _activeAgreement(uint256 agreementId) private view returns (Agreement storage a) {
        a = _agreements[agreementId];
        if (a.status != AgreementStatus.Active) revert WrongAgreementStatus();
    }

    function _milestone(Agreement storage a, uint256 agreementId, uint256 index)
        private
        view
        returns (Milestone storage)
    {
        if (index >= a.milestoneCount) revert UnknownMilestone();
        return _milestones[agreementId][index];
    }

    function _changeOrder(Agreement storage a, uint256 agreementId, uint256 changeOrderId)
        private
        view
        returns (ChangeOrder storage)
    {
        if (changeOrderId >= a.changeOrderCount) revert UnknownChangeOrder();
        return _changeOrders[agreementId][changeOrderId];
    }
}
