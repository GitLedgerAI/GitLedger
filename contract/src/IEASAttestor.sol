// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// IEASAttestor.sol
//
// Thin interface used by GitLedger to interact with the Ethereum Attestation
// Service (EAS) on Base.
//
// GitLedger only cares about three operations:
//   1. attest()  – create a new attestation, get back a UID
//   2. revoke()  – invalidate a previous attestation
//
// The concrete EAS contract on Base is:
//   0x4200000000000000000000000000000000000021  (Base mainnet)
//
// GitLedgerEASAttestor.sol wraps the real EAS and encodes the schema.
// In tests, MockEASAttestor.sol replaces it.
// ─────────────────────────────────────────────────────────────────────────────

interface IEASAttestor {
    /// @notice Create an on-chain attestation.
    /// @param schemaData ABI-encoded payload matching the registered EAS schema.
    /// @return uid  The attestation UID assigned by EAS.
    function attest(bytes calldata schemaData) external returns (bytes32 uid);

    /// @notice Revoke a previously-issued attestation.
    /// @param uid  UID to revoke. Must exist and be revocable.
    function revoke(bytes32 uid) external;
}
