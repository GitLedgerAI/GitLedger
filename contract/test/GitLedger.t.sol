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

    bytes32 public lastBasename;
    string public lastRepoSlug;
    uint256 public lastPrId;
    uint256 public lastStakeAmount;
    string public lastVerdict;
    uint256 public lastReviewedAt;
    uint256 public lastResolvedAt;
    int256 public lastReputationDelta;
    string public lastRepoLanguages;

    function attest(bytes calldata data) external returns (bytes32) {
        (
            bytes32,
            bytes32 basename,
            string memory repoSlug,
            uint256 prId,
            uint256 stakeAmount,
            string memory verdict,
            uint256 reviewedAt,
            uint256 resolvedAt,
            int256 reputationDelta,
            string memory repoLanguages
        ) = abi.decode(data, (bytes32, bytes32, string, uint256, uint256, string, uint256, uint256, int256, string));

        lastBasename = basename;
        lastRepoSlug = repoSlug;
        lastPrId = prId;
        lastStakeAmount = stakeAmount;
        lastVerdict = verdict;
        lastReviewedAt = reviewedAt;
        lastResolvedAt = resolvedAt;
        lastReputationDelta = reputationDelta;
        lastRepoLanguages = repoLanguages;

        return UID;
    }

    function revoke(bytes32) external pure {}
}

contract GitLedgerTest is Test {
    GitLedger internal ledger;
    MockUSDC internal usdc;
    MockEAS internal eas;
    address internal treasury = address(0xBEEF);
    address internal reviewer = address(0xCAFE);
    bytes32 internal basename = bytes32("alice.base.eth");

    function setUp() public {
        usdc = new MockUSDC();
        eas = new MockEAS();
        ledger = new GitLedger(address(eas), address(usdc), bytes32("schema"), address(this), treasury);
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

    function testStakeReviewAttestationPayloadIsEncoded() public {
        _stake();
        assertEq(eas.lastBasename(), basename);
        assertEq(eas.lastRepoSlug(), "org/repo");
        assertEq(eas.lastPrId(), 7);
        assertEq(eas.lastStakeAmount(), 10_000_000);
        assertEq(eas.lastVerdict(), "ACTIVE");
        assertEq(eas.lastResolvedAt(), 0);
        assertEq(eas.lastReputationDelta(), 0);
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
        assertEq(eas.lastVerdict(), "SLASHED");
        assertEq(eas.lastReputationDelta(), -50);
    }

    function testSlashIsIdempotencyGuarded() public {
        bytes32 stakeId = _stake();
        ledger.slashReview(stakeId, address(0x456));
        vm.expectRevert(GitLedger.AlreadyResolved.selector);
        ledger.slashReview(stakeId, address(0x456));
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
        assertEq(eas.lastVerdict(), "CLEAN");
        assertEq(eas.lastReputationDelta(), 5);
    }

    function testReleaseIsIdempotencyGuarded() public {
        bytes32 stakeId = _stake();
        vm.warp(block.timestamp + 31 days);
        ledger.releaseYield(stakeId);
        vm.expectRevert(GitLedger.AlreadyResolved.selector);
        ledger.releaseYield(stakeId);
    }

    function testReputationCapAt1000() public {
        bytes32 stakeId = _stake();
        vm.store(address(ledger), keccak256(abi.encode(basename, uint256(1))), bytes32(uint256(999)));
        vm.warp(block.timestamp + 31 days);
        ledger.releaseYield(stakeId);
        assertEq(ledger.reputation(basename), 1000);
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
