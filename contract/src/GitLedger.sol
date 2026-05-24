// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// GitLedger.sol
//
// Reviewers stake USDC when approving PRs.
// • ACTIVE  → stake is in escrow, settlement window open
// • CLEAN   → window elapsed without incident; principal + yield released
// • SLASHED → bad outcome inside window; principal split reporter/treasury
//
// Economic model: TREASURY-SUBSIDY YIELD
//   - Principal escrowed in this contract (stakeEscrow mapping)
//   - Yield paid from a separate yieldPoolBalance funded by treasuryManager
//   - If yield pool cannot cover computed yield, clean release REVERTS
//   - Slash does NOT touch yieldPoolBalance
//
// Trust boundaries:
//   - oracle (backend signer): sole authority to slash / release
//   - treasuryManager: sole authority to fund yield pool
//   - owner (deployer): can set oracle, treasuryManager, and base config
//
// USDC assumption: 6 decimals, non-rebasing, standard ERC-20 transferFrom/transfer
// ─────────────────────────────────────────────────────────────────────────────

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEASAttestor} from "./IEASAttestor.sol";

// ─── Custom errors ────────────────────────────────────────────────────────────
error NotOracle();
error NotTreasuryManager();
error StakeNotFound(bytes32 stakeId);
error StakeNotActive(bytes32 stakeId, StakeStatus status);
error StakeAlreadySettled(bytes32 stakeId);
error WindowNotElapsed(bytes32 stakeId, uint256 endsAt, uint256 now_);
error WindowAlreadyElapsed(bytes32 stakeId, uint256 endsAt, uint256 now_);
error InsufficientYieldPool(uint256 required, uint256 available);
error ZeroAmount();
error ZeroAddress();
error InvalidSlashBps(uint16 bps);
error InvalidYieldBps(uint16 bps);
error InvalidWindowDuration(uint256 duration);
error DuplicateStakeId(bytes32 stakeId);
error TransferFailed();

// ─── Enums / structs ─────────────────────────────────────────────────────────

enum StakeStatus {
    ACTIVE,
    CLEAN,
    SLASHED
}

struct StakeRecord {
    address reviewer;          // address that staked
    uint256 principal;         // USDC amount (6 dec)
    uint64  stakedAt;          // unix timestamp
    uint64  windowEndsAt;      // settlement window close
    uint16  yieldBps;          // annualised yield in bps (e.g. 500 = 5%)
    StakeStatus status;
    bytes32 easUid;            // EAS attestation UID (set on stake, updated on settle)
}

// ─── Events ───────────────────────────────────────────────────────────────────

event Staked(
    bytes32 indexed stakeId,
    address indexed reviewer,
    uint256 principal,
    uint64  windowEndsAt,
    uint16  yieldBps,
    bytes32 easUid
);

event Slashed(
    bytes32 indexed stakeId,
    address indexed reviewer,
    uint256 principalToReporter,
    uint256 principalToTreasury,
    bytes32 newEasUid
);

event Released(
    bytes32 indexed stakeId,
    address indexed reviewer,
    uint256 principal,
    uint256 yield_,
    bytes32 newEasUid
);

event YieldPoolFunded(address indexed by, uint256 amount);
event YieldPoolDebited(bytes32 indexed stakeId, uint256 amount);

event OracleUpdated(address indexed oldOracle, address indexed newOracle);
event TreasuryManagerUpdated(address indexed oldManager, address indexed newManager);
event TreasuryAddressUpdated(address indexed oldTreasury, address indexed newTreasury);

// ─── Contract ─────────────────────────────────────────────────────────────────

contract GitLedger is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Immutables ────────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    IEASAttestor public immutable easAttestor;

    // ── Access control ────────────────────────────────────────────────────────
    address public oracle;
    address public treasuryManager;
    address public treasury; // receives treasury portion on slash

    // ── Economic state ────────────────────────────────────────────────────────
    // INVARIANT: yieldPoolBalance == sum of USDC held in this contract not
    //   allocated to any stakeEscrow entry.
    uint256 public yieldPoolBalance;

    // stakeId → principal held in escrow
    mapping(bytes32 => uint256) public stakeEscrow;

    // stakeId → full record
    mapping(bytes32 => StakeRecord) private _stakes;

    // ── Protocol parameters (owner-settable) ──────────────────────────────────
    // Slash split: reporterSlashBps of principal to reporter, remainder to treasury
    // e.g. 5000 = 50%
    uint16 public reporterSlashBps = 5000;

    // Default slash bps guard (must total ≤ 10000)
    uint16 public constant MAX_BPS = 10_000;

    // Minimum / maximum settlement window
    uint256 public minWindowDuration = 1 hours;
    uint256 public maxWindowDuration = 30 days;

    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _easAttestor,
        address _oracle,
        address _treasuryManager,
        address _treasury,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_oracle == address(0)) revert ZeroAddress();
        if (_treasuryManager == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        easAttestor = IEASAttestor(_easAttestor);
        oracle = _oracle;
        treasuryManager = _treasuryManager;
        treasury = _treasury;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    modifier onlyTreasuryManager() {
        if (msg.sender != treasuryManager) revert NotTreasuryManager();
        _;
    }

    // ─── Core protocol functions ──────────────────────────────────────────────

    /// @notice Stake USDC to record a PR review approval.
    /// @param stakeId    Unique identifier (keccak256 of prId + reviewer off-chain)
    /// @param reviewer   Address receiving principal/yield on clean release
    /// @param principal  USDC amount (6 dec, non-zero)
    /// @param windowDuration  Seconds the settlement window stays open
    /// @param yieldBps   Annualised yield rate in basis points for this stake
    /// @param schemaData ABI-encoded EAS schema payload for ACTIVE attestation
    function stakeReview(
        bytes32 stakeId,
        address reviewer,
        uint256 principal,
        uint256 windowDuration,
        uint16  yieldBps,
        bytes   calldata schemaData
    ) external nonReentrant {
        // ── Validation ────────────────────────────────────────────────────────
        if (stakeId == bytes32(0)) revert StakeNotFound(stakeId);
        if (reviewer == address(0)) revert ZeroAddress();
        if (principal == 0) revert ZeroAmount();
        if (_stakes[stakeId].stakedAt != 0) revert DuplicateStakeId(stakeId);
        if (windowDuration < minWindowDuration || windowDuration > maxWindowDuration)
            revert InvalidWindowDuration(windowDuration);
        if (yieldBps > MAX_BPS) revert InvalidYieldBps(yieldBps);

        // ── Pull funds ────────────────────────────────────────────────────────
        // Reviewer (or delegating caller) must have pre-approved this contract.
        usdc.safeTransferFrom(msg.sender, address(this), principal);

        // ── EAS attestation: ACTIVE ───────────────────────────────────────────
        bytes32 easUid = _attest(schemaData);

        // ── Record ────────────────────────────────────────────────────────────
        uint64 now_ = uint64(block.timestamp);
        uint64 windowEndsAt = now_ + uint64(windowDuration);

        _stakes[stakeId] = StakeRecord({
            reviewer:     reviewer,
            principal:    principal,
            stakedAt:     now_,
            windowEndsAt: windowEndsAt,
            yieldBps:     yieldBps,
            status:       StakeStatus.ACTIVE,
            easUid:       easUid
        });

        stakeEscrow[stakeId] = principal;

        emit Staked(stakeId, reviewer, principal, windowEndsAt, yieldBps, easUid);
    }

    /// @notice Slash a stake within the settlement window (bad outcome / hotfix).
    /// @param stakeId    Target stake
    /// @param reporter   Address receiving the reporter's slash portion
    /// @param schemaData ABI-encoded EAS schema payload for SLASHED attestation
    function slashReview(
        bytes32 stakeId,
        address reporter,
        bytes   calldata schemaData
    ) external nonReentrant onlyOracle {
        StakeRecord storage s = _requireActive(stakeId);

        if (reporter == address(0)) revert ZeroAddress();

        // Slash must occur before the window closes
        if (block.timestamp >= s.windowEndsAt)
            revert WindowAlreadyElapsed(stakeId, s.windowEndsAt, block.timestamp);

        uint256 principal = s.principal;

        // ── Split principal: reporter + treasury ──────────────────────────────
        uint256 toReporter = (principal * reporterSlashBps) / MAX_BPS;
        uint256 toTreasury = principal - toReporter; // remainder; no dust loss

        // ── Update state before transfers (CEI) ───────────────────────────────
        s.status = StakeStatus.SLASHED;
        stakeEscrow[stakeId] = 0;

        // ── EAS attestation: SLASHED (revoke ACTIVE, issue SLASHED) ──────────
        bytes32 oldUid = s.easUid;
        bytes32 newUid = _attestAndRevoke(oldUid, schemaData);
        s.easUid = newUid;

        // ── Transfers (SafeERC20) ─────────────────────────────────────────────
        usdc.safeTransfer(reporter, toReporter);
        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }

        emit Slashed(stakeId, s.reviewer, toReporter, toTreasury, newUid);
    }

    /// @notice Release principal + yield after the settlement window has elapsed cleanly.
    /// @param stakeId    Target stake
    /// @param schemaData ABI-encoded EAS schema payload for CLEAN attestation
    function releaseYield(
        bytes32 stakeId,
        bytes   calldata schemaData
    ) external nonReentrant onlyOracle {
        StakeRecord storage s = _requireActive(stakeId);

        // Release only allowed after window closes
        if (block.timestamp < s.windowEndsAt)
            revert WindowNotElapsed(stakeId, s.windowEndsAt, block.timestamp);

        uint256 principal = s.principal;

        // ── Compute pro-rata yield ────────────────────────────────────────────
        // yield = principal × yieldBps × elapsed / (10000 × 365 days)
        // elapsed = actual time from stake to now (capped internally — we use
        //   actual block.timestamp so long-forgotten stakes accrue naturally).
        // Economic assumption: simple interest, annualised, 6-dec USDC.
        uint256 elapsed = block.timestamp - s.stakedAt;
        uint256 yieldAmount = _computeYield(principal, s.yieldBps, elapsed);

        // ── Check yield pool solvency BEFORE any state change ─────────────────
        if (yieldPoolBalance < yieldAmount)
            revert InsufficientYieldPool(yieldAmount, yieldPoolBalance);

        // ── Update state (CEI) ────────────────────────────────────────────────
        s.status = StakeStatus.CLEAN;
        stakeEscrow[stakeId] = 0;
        yieldPoolBalance -= yieldAmount;

        // ── EAS attestation: CLEAN ────────────────────────────────────────────
        bytes32 oldUid = s.easUid;
        bytes32 newUid = _attestAndRevoke(oldUid, schemaData);
        s.easUid = newUid;

        // ── Transfers ─────────────────────────────────────────────────────────
        uint256 total = principal + yieldAmount;
        usdc.safeTransfer(s.reviewer, total);

        emit YieldPoolDebited(stakeId, yieldAmount);
        emit Released(stakeId, s.reviewer, principal, yieldAmount, newUid);
    }

    // ─── Yield pool management ────────────────────────────────────────────────

    /// @notice Treasury manager funds the yield subsidy pool.
    /// @param amount USDC amount to pull from treasuryManager (must pre-approve)
    function fundYieldPool(uint256 amount) external nonReentrant onlyTreasuryManager {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        yieldPoolBalance += amount;
        emit YieldPoolFunded(msg.sender, amount);
    }

    // ─── Admin / config ───────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, _oracle);
        oracle = _oracle;
    }

    function setTreasuryManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert ZeroAddress();
        emit TreasuryManagerUpdated(treasuryManager, _manager);
        treasuryManager = _manager;
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryAddressUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @param bps Reporter's share of slashed principal (max 10000)
    function setReporterSlashBps(uint16 bps) external onlyOwner {
        if (bps > MAX_BPS) revert InvalidSlashBps(bps);
        reporterSlashBps = bps;
    }

    function setWindowBounds(uint256 min_, uint256 max_) external onlyOwner {
        require(min_ > 0 && max_ >= min_, "invalid window bounds");
        minWindowDuration = min_;
        maxWindowDuration = max_;
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    function getStake(bytes32 stakeId) external view returns (StakeRecord memory) {
        return _stakes[stakeId];
    }

    function getStakeStatus(bytes32 stakeId) external view returns (StakeStatus) {
        return _stakes[stakeId].status;
    }

    function previewYield(bytes32 stakeId) external view returns (uint256) {
        StakeRecord memory s = _stakes[stakeId];
        if (s.stakedAt == 0) return 0;
        uint256 elapsed = block.timestamp - s.stakedAt;
        return _computeYield(s.principal, s.yieldBps, elapsed);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _requireActive(bytes32 stakeId) internal view returns (StakeRecord storage s) {
        s = _stakes[stakeId];
        if (s.stakedAt == 0) revert StakeNotFound(stakeId);
        if (s.status != StakeStatus.ACTIVE) revert StakeNotActive(stakeId, s.status);
    }

    /// @dev Simple interest: principal × bps × elapsed / (10000 × 365 days)
    ///      Integer division truncates — no dust issues for 6-dec USDC.
    function _computeYield(
        uint256 principal,
        uint16  yieldBps,
        uint256 elapsed
    ) internal pure returns (uint256) {
        if (yieldBps == 0 || elapsed == 0) return 0;
        return (principal * yieldBps * elapsed) / (uint256(MAX_BPS) * 365 days);
    }

    /// @dev Issue an EAS attestation. Returns bytes32(0) if EAS not configured.
    function _attest(bytes calldata schemaData) internal returns (bytes32) {
        if (address(easAttestor) == address(0)) return bytes32(0);
        return easAttestor.attest(schemaData);
    }

    /// @dev Revoke old UID and issue a new attestation. Safe if EAS not configured.
    function _attestAndRevoke(bytes32 oldUid, bytes calldata schemaData)
        internal returns (bytes32)
    {
        if (address(easAttestor) == address(0)) return bytes32(0);
        easAttestor.revoke(oldUid);
        return easAttestor.attest(schemaData);
    }
}
