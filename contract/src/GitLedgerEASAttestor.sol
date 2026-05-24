// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// GitLedgerEASAttestor.sol
//
// Adapts GitLedger's IEASAttestor interface to the real EAS contract on Base.
//
// Schema:
//   bytes32 stakeId, address reviewer, string status, bytes32 prHash
//
// Status strings:
//   "ACTIVE"   – stake created
//   "CLEAN"    – window elapsed, clean release
//   "SLASHED"  – bad outcome, principal slashed
//
// Deployment:
//   - Deploy this contract, grant it ATTESTER role (or simply point it to EAS).
//   - Pass its address to the GitLedger constructor.
//   - Only GitLedger should call attest/revoke (access-controlled).
//
// EAS on Base: 0x4200000000000000000000000000000000000021
// ─────────────────────────────────────────────────────────────────────────────

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEASAttestor} from "./IEASAttestor.sol";

/// @dev Minimal EAS interface (only what we need)
interface IEAS {
    struct AttestationRequest {
        bytes32 schema;
        AttestationRequestData data;
    }

    struct AttestationRequestData {
        address recipient;
        uint64  expirationTime;
        bool    revocable;
        bytes32 refUID;
        bytes   data;
        uint256 value;
    }

    struct RevocationRequest {
        bytes32 schema;
        RevocationRequestData data;
    }

    struct RevocationRequestData {
        bytes32 uid;
        uint256 value;
    }

    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function revoke(RevocationRequest calldata request) external payable;
}

contract GitLedgerEASAttestor is IEASAttestor, Ownable {
    IEAS  public immutable eas;
    bytes32 public immutable schemaUID;

    // Only the GitLedger contract may call attest/revoke
    address public gitLedger;

    event GitLedgerSet(address indexed addr);

    error NotGitLedger();
    error ZeroAddress();

    constructor(
        address _eas,
        bytes32 _schemaUID,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_eas == address(0)) revert ZeroAddress();
        eas = IEAS(_eas);
        schemaUID = _schemaUID;
    }

    modifier onlyGitLedger() {
        if (msg.sender != gitLedger) revert NotGitLedger();
        _;
    }

    function setGitLedger(address _gitLedger) external onlyOwner {
        if (_gitLedger == address(0)) revert ZeroAddress();
        gitLedger = _gitLedger;
        emit GitLedgerSet(_gitLedger);
    }

    // ─── IEASAttestor ─────────────────────────────────────────────────────────

    /// @inheritdoc IEASAttestor
    /// @param schemaData ABI-encoded (bytes32 stakeId, address reviewer, string status, bytes32 prHash)
    function attest(bytes calldata schemaData)
        external
        override
        onlyGitLedger
        returns (bytes32)
    {
        IEAS.AttestationRequest memory req = IEAS.AttestationRequest({
            schema: schemaUID,
            data: IEAS.AttestationRequestData({
                recipient:      address(0),
                expirationTime: 0,
                revocable:      true,
                refUID:         bytes32(0),
                data:           schemaData,
                value:          0
            })
        });
        return eas.attest(req);
    }

    /// @inheritdoc IEASAttestor
    function revoke(bytes32 uid) external override onlyGitLedger {
        IEAS.RevocationRequest memory req = IEAS.RevocationRequest({
            schema: schemaUID,
            data: IEAS.RevocationRequestData({uid: uid, value: 0})
        });
        eas.revoke(req);
    }

    // ─── Schema helpers (view-only, for off-chain use) ────────────────────────

    /// @notice Encode an ACTIVE attestation payload.
    function encodeActive(
        bytes32 stakeId,
        address reviewer,
        bytes32 prHash
    ) external pure returns (bytes memory) {
        return abi.encode(stakeId, reviewer, "ACTIVE", prHash);
    }

    /// @notice Encode a CLEAN attestation payload.
    function encodeClean(
        bytes32 stakeId,
        address reviewer,
        bytes32 prHash
    ) external pure returns (bytes memory) {
        return abi.encode(stakeId, reviewer, "CLEAN", prHash);
    }

    /// @notice Encode a SLASHED attestation payload.
    function encodeSlashed(
        bytes32 stakeId,
        address reviewer,
        bytes32 prHash
    ) external pure returns (bytes memory) {
        return abi.encode(stakeId, reviewer, "SLASHED", prHash);
    }
}
