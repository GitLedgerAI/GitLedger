// script/deploy.js
// Deploy GitLedger to Base (mainnet or Sepolia).
//
// Usage:
//   BASE_RPC_URL=... DEPLOYER_PRIVATE_KEY=0x... \
//   ORACLE_ADDRESS=0x... TREASURY_MANAGER=0x... TREASURY=0x... \
//   npx hardhat run script/deploy.js --network base-sepolia
//
// Env vars:
//   ORACLE_ADDRESS        – backend oracle EOA
//   TREASURY_MANAGER      – address allowed to fund yield pool
//   TREASURY              – receives treasury portion of slashes
//   EAS_ADDRESS           – EAS contract on Base (default: Base mainnet)
//   EAS_SCHEMA_UID        – registered EAS schema UID
//   USDC_ADDRESS          – USDC on Base (default: Base mainnet USDC)

const { ethers } = require("hardhat");

// ─── Base mainnet well-known addresses ────────────────────────────────────────
const BASE_USDC    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const BASE_EAS     = "0x4200000000000000000000000000000000000021"; // EAS on Base

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // ── Config from env ────────────────────────────────────────────────────────
    const oracleAddress         = requireEnv("ORACLE_ADDRESS");
    const treasuryManagerAddr   = requireEnv("TREASURY_MANAGER");
    const treasuryAddr          = requireEnv("TREASURY");
    const easAddress            = process.env.EAS_ADDRESS    || BASE_EAS;
    const usdcAddress           = process.env.USDC_ADDRESS   || BASE_USDC;
    const easSchemaUID          = process.env.EAS_SCHEMA_UID || ethers.ZeroHash;

    console.log("\n── Deployment params ──────────────────────────────────────");
    console.log("  USDC:             ", usdcAddress);
    console.log("  EAS:              ", easAddress);
    console.log("  EAS Schema UID:   ", easSchemaUID);
    console.log("  Oracle:           ", oracleAddress);
    console.log("  Treasury Manager: ", treasuryManagerAddr);
    console.log("  Treasury:         ", treasuryAddr);

    // ── Deploy EASAttestor ─────────────────────────────────────────────────────
    const Attestor = await ethers.getContractFactory("GitLedgerEASAttestor");
    console.log("\n[1/3] Deploying GitLedgerEASAttestor...");
    const attestor = await Attestor.deploy(easAddress, easSchemaUID, deployer.address);
    await attestor.waitForDeployment();
    const attestorAddr = await attestor.getAddress();
    console.log("      GitLedgerEASAttestor:", attestorAddr);

    // ── Deploy GitLedger ───────────────────────────────────────────────────────
    const GitLedger = await ethers.getContractFactory("GitLedger");
    console.log("[2/3] Deploying GitLedger...");
    const gl = await GitLedger.deploy(
        usdcAddress,
        attestorAddr,
        oracleAddress,
        treasuryManagerAddr,
        treasuryAddr,
        deployer.address
    );
    await gl.waitForDeployment();
    const glAddr = await gl.getAddress();
    console.log("      GitLedger:", glAddr);

    // ── Wire attestor → GitLedger ──────────────────────────────────────────────
    console.log("[3/3] Wiring attestor.setGitLedger...");
    const tx = await attestor.setGitLedger(glAddr);
    await tx.wait();
    console.log("      Done.");

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log("\n── Deployed addresses ─────────────────────────────────────");
    console.log("  GitLedger:              ", glAddr);
    console.log("  GitLedgerEASAttestor:   ", attestorAddr);
    console.log("\nNext steps:");
    console.log("  1. Verify on Basescan:");
    console.log(`     npx hardhat verify --network base-sepolia ${glAddr} \\`);
    console.log(`       "${usdcAddress}" "${attestorAddr}" "${oracleAddress}" "${treasuryManagerAddr}" "${treasuryAddr}" "${deployer.address}"`);
    console.log("  2. Fund yield pool via treasuryManager: fundYieldPool(amount)");
    console.log("  3. Register EAS schema if easSchemaUID is ZeroHash.");
}

function requireEnv(name) {
    const val = process.env[name];
    if (!val) throw new Error(`Missing env var: ${name}`);
    return val;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
