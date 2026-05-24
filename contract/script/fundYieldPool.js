// script/fundYieldPool.js
// Fund the GitLedger yield pool from the treasury manager account.
//
// Usage:
//   GITLEDGER_ADDRESS=0x... USDC_ADDRESS=0x... AMOUNT_USDC=1000 \
//   npx hardhat run script/fundYieldPool.js --network base-sepolia

const { ethers } = require("hardhat");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    const glAddress = requireEnv("GITLEDGER_ADDRESS");
    const usdcAddress = process.env.USDC_ADDRESS || BASE_USDC;
    const amountUsdc = process.env.AMOUNT_USDC || "1000";
    const treasuryManagerPk = process.env.TREASURY_MANAGER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!treasuryManagerPk) {
        throw new Error("Missing TREASURY_MANAGER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY fallback)");
    }
    const treasuryManager = new ethers.Wallet(
        treasuryManagerPk.startsWith("0x") ? treasuryManagerPk : `0x${treasuryManagerPk}`,
        ethers.provider
    );

    const amount = ethers.parseUnits(amountUsdc, 6);

    const usdc = await ethers.getContractAt(
        [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)"
        ],
        usdcAddress
    );
    const gl = await ethers.getContractAt("GitLedger", glAddress);

    const configuredTreasuryManager = await gl.treasuryManager();
    if (configuredTreasuryManager.toLowerCase() !== treasuryManager.address.toLowerCase()) {
        throw new Error(
            `Signer ${treasuryManager.address} is not contract treasuryManager ${configuredTreasuryManager}`
        );
    }

    console.log("Treasury manager:", treasuryManager.address);
    console.log("Funding yield pool with:", amountUsdc, "USDC");
    const usdcBal = await usdc.balanceOf(treasuryManager.address);
    console.log("Treasury manager USDC balance:", ethers.formatUnits(usdcBal, 6));

    // Approve
    const approveTx = await usdc.connect(treasuryManager).approve(glAddress, amount);
    await approveTx.wait();
    console.log("Approved.");

    // Fund
    const tx = await gl.connect(treasuryManager).fundYieldPool(amount);
    const receipt = await tx.wait();
    console.log("Funded. Tx:", receipt.hash);

    const pool = await gl.yieldPoolBalance();
    console.log("New yieldPoolBalance:", ethers.formatUnits(pool, 6), "USDC");
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
