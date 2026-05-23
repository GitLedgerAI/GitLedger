// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GitLedger} from "../src/GitLedger.sol";

contract MockUSDC {
    bool public failTransfers;

    function setFailTransfers(bool fail_) external {
        failTransfers = fail_;
    }

    function transferFrom(address, address, uint256) external view returns (bool) {
        return !failTransfers;
    }

    function transfer(address, uint256) external view returns (bool) {
        return !failTransfers;
    }
}

contract MockEAS {
    bytes32 private constant UID = keccak256("uid");
    function attest(bytes calldata) external pure returns (bytes32) { return UID; }
    function revoke(bytes32) external pure {}
}

contract GitLedgerTest is Test {
    GitLedger internal ledger;
    MockUSDC internal usdc;
    address internal treasury = address(0xBEEF);
    address internal reviewer = address(0xCAFE);
    bytes32 internal basename = bytes32("alice.base.eth");

    function setUp() public {
        usdc = new MockUSDC();
        ledger = new GitLedger(address(new MockEAS()), address(usdc), bytes32("schema"), address(this), treasury);
    }

    function _stake() internal returns (bytes32 stakeId) {
        vm.prank(reviewer);
        stakeId = ledger.stakeReview(basename, "org/repo", 7, 10_000_000);
    }

    function testStakeReviewSetsActiveState() public {
        bytes32 stakeId = _stake();
        (, , , , , , , GitLedger.StakeState state) = ledger.stakes(stakeId);
        assertEq(uint8(state), uint8(GitLedger.StakeState.Active));
    }

    function testOnlyOracleCanSlash() public {
        bytes32 stakeId = _stake();
        vm.prank(address(0x123));
        vm.expectRevert(GitLedger.OnlyOracle.selector);
        ledger.slashReview(stakeId, address(0x456));
    }

    function testSlashTransitionsState() public {
        bytes32 stakeId = _stake();
        ledger.slashReview(stakeId, address(0x456));
        (, , , , , , , GitLedger.StakeState state) = ledger.stakes(stakeId);
        assertEq(uint8(state), uint8(GitLedger.StakeState.Slashed));
    }

    function testReleaseRequiresWindowEnd() public {
        bytes32 stakeId = _stake();
        vm.expectRevert(GitLedger.OracleWindowNotFinished.selector);
        ledger.releaseYield(stakeId);
    }

    function testReleaseTransitionsStateAfterWindow() public {
        bytes32 stakeId = _stake();
        vm.warp(block.timestamp + 31 days);
        ledger.releaseYield(stakeId);
        (, , , , , , , GitLedger.StakeState state) = ledger.stakes(stakeId);
        assertEq(uint8(state), uint8(GitLedger.StakeState.Released));
    }

    function testStakeRevertsOnZeroAmount() public {
        vm.prank(reviewer);
        vm.expectRevert(GitLedger.InvalidAmount.selector);
        ledger.stakeReview(basename, "org/repo", 7, 0);
    }

    function testRevertsOnFailedTokenTransfer() public {
        usdc.setFailTransfers(true);
        vm.prank(reviewer);
        vm.expectRevert(GitLedger.TokenTransferFailed.selector);
        ledger.stakeReview(basename, "org/repo", 7, 10_000_000);
    }
}
