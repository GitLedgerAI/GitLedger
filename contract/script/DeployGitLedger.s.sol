// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {GitLedger} from "../src/GitLedger.sol";

contract DeployGitLedger is Script {
    function run() external returns (GitLedger deployed) {
        address eas = vm.envAddress("EAS_CONTRACT_BASE");
        address usdc = vm.envAddress("USDC_BASE");
        bytes32 schema = vm.envBytes32("EAS_SCHEMA_UID");
        address oracle = vm.envAddress("GITLEDGER_ORACLE");
        address treasury = vm.envAddress("GITLEDGER_TREASURY");

        vm.startBroadcast();
        deployed = new GitLedger(eas, usdc, schema, oracle, treasury);
        vm.stopBroadcast();
    }
}
