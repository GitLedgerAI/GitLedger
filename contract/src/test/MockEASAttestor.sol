// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEASAttestor} from "../IEASAttestor.sol";

/// @dev Test double for EAS. Tracks attested/revoked UIDs for assertions.
contract MockEASAttestor is IEASAttestor {
    uint256 private _nonce;
    mapping(bytes32 => bool) public isActive;
    mapping(bytes32 => bool) public wasRevoked;
    mapping(bytes32 => bytes) public payloads;

    bytes32[] public allUids;

    // Optionally force revert on attest to test failure paths
    bool public revertOnAttest;
    bool public revertOnRevoke;

    function setRevertOnAttest(bool v) external { revertOnAttest = v; }
    function setRevertOnRevoke(bool v) external { revertOnRevoke = v; }

    function attest(bytes calldata schemaData) external override returns (bytes32 uid) {
        if (revertOnAttest) revert("EAS: attest failed");
        uid = keccak256(abi.encodePacked(block.timestamp, _nonce++, schemaData));
        isActive[uid] = true;
        payloads[uid] = schemaData;
        allUids.push(uid);
    }

    function revoke(bytes32 uid) external override {
        if (revertOnRevoke) revert("EAS: revoke failed");
        isActive[uid] = false;
        wasRevoked[uid] = true;
    }

    function totalAttestations() external view returns (uint256) {
        return allUids.length;
    }
}
