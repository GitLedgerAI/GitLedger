// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GitLedger} from "../src/GitLedger.sol";

contract MockUSDC {
    function transferFrom(address, address, uint256) external pure returns (bool) { return true; }
    function transfer(address, uint256) external pure returns (bool) { return true; }
}

contract MockEAS {
    bytes32 private constant UID = keccak256("uid");
    function attest(bytes calldata) external pure returns (bytes32) { return UID; }
    function revoke(bytes32) external pure {}
}

contract GitLedgerTest is Test {
    GitLedger internal ledger;

    function setUp() public {
        ledger = new GitLedger(address(new MockEAS()), address(new MockUSDC()), bytes32("schema"), address(this), address(0xBEEF));
    }

    function testStakeReviewSetsActiveState() public {
        bytes32 stakeId = ledger.stakeReview(bytes32("alice.base.eth"), "org/repo", 7, 10_000_000);
        (, , , , , , , GitLedger.StakeState state) = ledger.stakes(stakeId);
        assertEq(uint8(state), uint8(GitLedger.StakeState.Active));
    }
}
