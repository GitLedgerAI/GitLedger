// scripts/fundYieldPool.ts — top up the GitLedger yield pool.
//
// Usage:
//   bun src/scripts/fundYieldPool.ts <amountUsdc>
//
// Where <amountUsdc> is a HUMAN-READABLE amount (e.g. "10" = 10 USDC).
// The script multiplies by 1e6 internally to get micro-USDC.
//
// Requires TREASURY_MANAGER_PRIVATE_KEY in env. The signer must match the
// `treasuryManager()` configured on the GitLedger contract (set at deploy).
//
// Steps:
//   1. Validate signer matches contract.treasuryManager()
//   2. Check USDC balance & allowance
//   3. Approve USDC -> contract if allowance insufficient
//   4. Call fundYieldPool(amountMicro)
//   5. Print updated yieldPoolBalance

import { createWalletClient, http } from 'viem';
import { parseUnits } from 'viem/utils';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi, gitLedgerAbi } from '../chain/abi';
import { basePublicClient } from '../chain/client';
import { env } from '../config/env';

const amountArg = process.argv[2];
if (!amountArg) {
  console.error('Usage: bun src/scripts/fundYieldPool.ts <amountUsdc>');
  console.error('Example: bun src/scripts/fundYieldPool.ts 25     # fund 25 USDC');
  process.exit(1);
}

const tmKey = env.TREASURY_MANAGER_PRIVATE_KEY;
if (!tmKey) {
  console.error('TREASURY_MANAGER_PRIVATE_KEY is not set. Add it to .env before running this script.');
  process.exit(1);
}

const amountMicro = parseUnits(amountArg, 6);
if (amountMicro <= 0n) {
  console.error(`Invalid amount: ${amountArg}`);
  process.exit(1);
}

const normalizedKey = tmKey.startsWith('0x') ? (tmKey as `0x${string}`) : (`0x${tmKey}` as `0x${string}`);
const tmAccount = privateKeyToAccount(normalizedKey);

const tmWallet = createWalletClient({
  account: tmAccount,
  chain: base,
  transport: http(env.BASE_RPC_URL),
});

const contractAddress = env.GITLEDGER_CONTRACT as `0x${string}`;

console.log('[fund-yield] starting', {
  treasuryManager: tmAccount.address,
  contract: contractAddress,
  amountUsdc: amountArg,
  amountMicro: amountMicro.toString(),
});

// 1. Verify signer is the configured treasury manager.
const configuredTm = (await basePublicClient.readContract({
  address: contractAddress,
  abi: gitLedgerAbi,
  functionName: 'treasuryManager',
})) as `0x${string}`;

if (configuredTm.toLowerCase() !== tmAccount.address.toLowerCase()) {
  console.error('[fund-yield] signer is NOT the configured treasury manager', {
    signer: tmAccount.address,
    configured: configuredTm,
  });
  process.exit(2);
}
console.log('[fund-yield] signer matches contract.treasuryManager()');

// 2. Read USDC address from contract + balance/allowance.
const usdcAddress = (await basePublicClient.readContract({
  address: contractAddress,
  abi: gitLedgerAbi,
  functionName: 'usdc',
})) as `0x${string}`;

const [balance, allowance, currentPool] = await Promise.all([
  basePublicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [tmAccount.address],
  }),
  basePublicClient.readContract({
    address: usdcAddress,
    abi: [
      {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const,
    functionName: 'allowance',
    args: [tmAccount.address, contractAddress],
  }),
  basePublicClient.readContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'yieldPoolBalance',
  }),
]);

const balanceBn = balance as bigint;
const allowanceBn = allowance as bigint;
const currentPoolBn = currentPool as bigint;

console.log('[fund-yield] state before', {
  usdc: usdcAddress,
  treasuryManagerBalanceMicro: balanceBn.toString(),
  allowanceMicro: allowanceBn.toString(),
  currentYieldPoolMicro: currentPoolBn.toString(),
});

if (balanceBn < amountMicro) {
  console.error('[fund-yield] insufficient USDC balance', {
    needed: amountMicro.toString(),
    have: balanceBn.toString(),
  });
  process.exit(3);
}

// 3. Approve if allowance insufficient.
if (allowanceBn < amountMicro) {
  console.log('[fund-yield] approving USDC to contract');
  const approveHash = await tmWallet.writeContract({
    address: usdcAddress,
    abi: [
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const,
    functionName: 'approve',
    args: [contractAddress, amountMicro],
  });
  console.log('[fund-yield] approve tx submitted', { txHash: approveHash });
  await basePublicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log('[fund-yield] approve confirmed');
} else {
  console.log('[fund-yield] allowance already sufficient — skipping approve');
}

// 4. Call fundYieldPool.
console.log('[fund-yield] calling fundYieldPool');
const fundHash = await tmWallet.writeContract({
  address: contractAddress,
  abi: gitLedgerAbi,
  functionName: 'fundYieldPool',
  args: [amountMicro],
});
console.log('[fund-yield] fundYieldPool tx submitted', { txHash: fundHash });
await basePublicClient.waitForTransactionReceipt({ hash: fundHash });
console.log('[fund-yield] fundYieldPool confirmed');

// 5. Re-read pool balance.
const newPool = (await basePublicClient.readContract({
  address: contractAddress,
  abi: gitLedgerAbi,
  functionName: 'yieldPoolBalance',
})) as bigint;

console.log('[fund-yield] DONE', {
  fundedMicro: amountMicro.toString(),
  yieldPoolBeforeMicro: currentPoolBn.toString(),
  yieldPoolAfterMicro: newPool.toString(),
  fundTxHash: fundHash,
});

process.exit(0);
