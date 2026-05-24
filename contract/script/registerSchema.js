/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const SCHEMA_REGISTRY = "0x4200000000000000000000000000000000000020";
const DEFAULT_BASE_RPC = "https://mainnet.base.org";
const DEFAULT_SCHEMA = "bytes32 stakeId, address reviewer, string status, bytes32 prHash";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SCHEMA_REGISTRY_ABI = [
  "function register(string schema, address resolver, bool revocable) external returns (bytes32)",
];

function loadPrivateKey() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY is required in environment");
  return pk.startsWith("0x") ? pk : `0x${pk}`;
}

function updateEnvSchemaUid(schemaUid) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.log(`[warn] .env not found at ${envPath}; skipping file update`);
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  const next = content.match(/^EAS_SCHEMA_UID=/m)
    ? content.replace(/^EAS_SCHEMA_UID=.*$/m, `EAS_SCHEMA_UID=${schemaUid}`)
    : `${content.trimEnd()}\nEAS_SCHEMA_UID=${schemaUid}\n`;
  fs.writeFileSync(envPath, next, "utf8");
  console.log(`[ok] Updated .env EAS_SCHEMA_UID=${schemaUid}`);
}

async function main() {
  const rpc = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC;
  const schema = process.env.EAS_SCHEMA_STRING || DEFAULT_SCHEMA;
  const revocable = (process.env.EAS_SCHEMA_REVOCABLE || "true").toLowerCase() !== "false";
  const resolver = process.env.EAS_SCHEMA_RESOLVER || ZERO_ADDRESS;
  const writeEnv = (process.env.WRITE_ENV || "false").toLowerCase() === "true";

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(loadPrivateKey(), provider);
  const registry = new ethers.Contract(SCHEMA_REGISTRY, SCHEMA_REGISTRY_ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`deployer=${wallet.address}`);
  console.log(`balanceEth=${ethers.formatEther(balance)}`);
  console.log(`registry=${SCHEMA_REGISTRY}`);
  console.log(`schema="${schema}"`);
  console.log(`resolver=${resolver}`);
  console.log(`revocable=${revocable}`);

  const tx = await registry.register(schema, resolver, revocable);
  console.log(`txHash=${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`status=${receipt.status}`);

  const parsed = receipt.logs
    .map((log) => {
      try {
        return registry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(Boolean);

  if (!parsed) throw new Error("Could not parse SchemaRegistered event from receipt");

  const uid = parsed.args?.uid || parsed.args?.[0];
  if (!uid) throw new Error("Schema UID missing from parsed event");

  console.log(`schemaUid=${uid}`);
  console.log(`Set this in env: EAS_SCHEMA_UID=${uid}`);

  if (writeEnv) updateEnvSchemaUid(uid);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

