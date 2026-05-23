// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IEAS} from "./interfaces.sol";

contract GitLedger {
    IEAS public immutable eas;
    IERC20 public immutable usdc;
    bytes32 public immutable schema;
    address public immutable chainlinkOracle;
    address public treasury;

    uint256 public constant ORACLE_WINDOW = 30 days;
    uint256 public constant REPORTER_SHARE = 7000;
    uint256 public constant TREASURY_SHARE = 3000;

    enum StakeState {
        Active,
        Slashed,
        Released
    }

    struct StakeRecord {
        address reviewer;
        bytes32 basename;
        string repoSlug;
        uint256 prId;
        uint256 amount;
        uint256 stakedAt;
        bytes32 attestationUID;
        StakeState state;
    }

    struct AttestationPayload {
        bytes32 basename;
        string repoSlug;
        uint256 prId;
        uint256 stakeAmount;
        string verdict;
        uint256 reviewedAt;
        uint256 resolvedAt;
        int256 reputationDelta;
        string repoLanguages;
    }

    mapping(bytes32 => StakeRecord) public stakes;
    mapping(bytes32 => uint256) public reputation;

    event StakeLocked(bytes32 indexed stakeId, address indexed reviewer, uint256 amount);
    event ReviewSlashed(bytes32 indexed stakeId, address indexed reporter, uint256 reporterAmount);
    event YieldReleased(bytes32 indexed stakeId, address indexed reviewer, uint256 totalReturned);

    error OnlyOracle();
    error InvalidStakeState();
    error OracleWindowNotFinished();
    error InvalidAmount();
    error InvalidAddress();
    error TokenTransferFailed();
    error AlreadyResolved();

    constructor(address eas_, address usdc_, bytes32 schema_, address oracle_, address treasury_) {
        if (eas_ == address(0) || usdc_ == address(0) || oracle_ == address(0) || treasury_ == address(0)) {
            revert InvalidAddress();
        }

        eas = IEAS(eas_);
        usdc = IERC20(usdc_);
        schema = schema_;
        chainlinkOracle = oracle_;
        treasury = treasury_;
    }

    function stakeReview(bytes32 basename, string calldata repoSlug, uint256 prId, uint256 amount)
        external
        returns (bytes32 stakeId)
    {
        if (amount == 0) revert InvalidAmount();

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TokenTransferFailed();

        stakeId = keccak256(abi.encode(msg.sender, repoSlug, prId));
        stakes[stakeId] = StakeRecord({
            reviewer: msg.sender,
            basename: basename,
            repoSlug: repoSlug,
            prId: prId,
            amount: amount,
            stakedAt: block.timestamp,
            attestationUID: bytes32(0),
            state: StakeState.Active
        });

        AttestationPayload memory payload = AttestationPayload({
            basename: basename,
            repoSlug: repoSlug,
            prId: prId,
            stakeAmount: amount,
            verdict: "ACTIVE",
            reviewedAt: block.timestamp,
            resolvedAt: 0,
            reputationDelta: 0,
            repoLanguages: ""
        });

        bytes32 uid = eas.attest(_buildAttestationPayload(payload));
        stakes[stakeId].attestationUID = uid;

        emit StakeLocked(stakeId, msg.sender, amount);
    }

    function slashReview(bytes32 stakeId, address reporter) external onlyOracle {
        if (reporter == address(0)) revert InvalidAddress();

        StakeRecord storage s = stakes[stakeId];
        if (s.state == StakeState.Slashed || s.state == StakeState.Released) revert AlreadyResolved();
        if (s.state != StakeState.Active) revert InvalidStakeState();

        s.state = StakeState.Slashed;
        uint256 reporterAmount = (s.amount * REPORTER_SHARE) / 10_000;

        bool repPaid = usdc.transfer(reporter, reporterAmount);
        bool treasuryPaid = usdc.transfer(treasury, s.amount - reporterAmount);
        if (!repPaid || !treasuryPaid) revert TokenTransferFailed();

        uint256 current = reputation[s.basename];
        reputation[s.basename] = current >= 50 ? current - 50 : 0;

        eas.revoke(s.attestationUID);

        AttestationPayload memory payload = AttestationPayload({
            basename: s.basename,
            repoSlug: s.repoSlug,
            prId: s.prId,
            stakeAmount: s.amount,
            verdict: "SLASHED",
            reviewedAt: s.stakedAt,
            resolvedAt: block.timestamp,
            reputationDelta: -50,
            repoLanguages: ""
        });

        eas.attest(_buildAttestationPayload(payload));

        emit ReviewSlashed(stakeId, reporter, reporterAmount);
    }

    function releaseYield(bytes32 stakeId) external onlyOracle {
        StakeRecord storage s = stakes[stakeId];
        if (s.state == StakeState.Slashed || s.state == StakeState.Released) revert AlreadyResolved();
        if (s.state != StakeState.Active) revert InvalidStakeState();
        if (block.timestamp <= s.stakedAt + ORACLE_WINDOW) revert OracleWindowNotFinished();

        s.state = StakeState.Released;

        uint256 yld = computeYield(stakeId);
        bool paid = usdc.transfer(s.reviewer, s.amount + yld);
        if (!paid) revert TokenTransferFailed();

        uint256 nextScore = reputation[s.basename] + 5;
        reputation[s.basename] = _min(nextScore, 1000);

        eas.revoke(s.attestationUID);

        AttestationPayload memory payload = AttestationPayload({
            basename: s.basename,
            repoSlug: s.repoSlug,
            prId: s.prId,
            stakeAmount: s.amount,
            verdict: "CLEAN",
            reviewedAt: s.stakedAt,
            resolvedAt: block.timestamp,
            reputationDelta: 5,
            repoLanguages: ""
        });

        eas.attest(_buildAttestationPayload(payload));

        emit YieldReleased(stakeId, s.reviewer, s.amount + yld);
    }

    function computeYield(bytes32 stakeId) public view returns (uint256) {
        StakeRecord storage s = stakes[stakeId];
        uint256 elapsed = block.timestamp - s.stakedAt;
        uint256 base = (s.amount * 1800 * elapsed) / (365 days * 10_000);
        uint256 mult = reputation[s.basename] > 700 ? 15_000 : 10_000;
        return _min((base * mult) / 10_000, s.amount * 3);
    }

    modifier onlyOracle() {
        if (msg.sender != chainlinkOracle) revert OnlyOracle();
        _;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _buildAttestationPayload(AttestationPayload memory payload) internal view returns (bytes memory) {
        return abi.encode(
            schema,
            payload.basename,
            payload.repoSlug,
            payload.prId,
            payload.stakeAmount,
            payload.verdict,
            payload.reviewedAt,
            payload.resolvedAt,
            payload.reputationDelta,
            payload.repoLanguages
        );
    }
}
