import { sql } from 'drizzle-orm';
import { erc20Abi, gitLedgerAbi } from '../chain/abi';
import { basePublicClient } from '../chain/client';
import { env } from '../config/env';
import { db } from '../db/client';
import { stakes } from '../db/schema';

const contractAddress = env.GITLEDGER_CONTRACT as `0x${string}`;

export type ProtocolValueReport = {
  network: { chainId: number; rpcUrl: string };
  contract: {
    address: `0x${string}`;
    usdc: `0x${string}`;
    treasury: `0x${string}`;
    oracle: `0x${string}`;
    reporterSlashBps: number;
    minWindowDurationSeconds: string;
    maxWindowDurationSeconds: string;
  };
  treasury: {
    address: `0x${string}`;
    usdcBalanceMicro: string;
    usdcBalanceFormatted: string;
  };
  protocolEscrow: {
    contractUsdcBalanceMicro: string;
    contractUsdcBalanceFormatted: string;
    yieldPoolMicro: string;
    yieldPoolFormatted: string;
    activeStakeEscrowMicro: string;
    activeStakeEscrowFormatted: string;
  };
  stakes: {
    byState: Array<{ state: string; count: number; totalUsdcMicro: string; totalUsdcFormatted: string }>;
    totalsMicro: { active: string; slashed: string; clean: string; pendingStake: string };
  };
  generatedAt: string;
};

function formatUsdc(micro: bigint): string {
  // 6-decimal USDC → human-readable string
  const whole = micro / 1_000_000n;
  const frac = micro % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}

export async function getProtocolValueReport(): Promise<ProtocolValueReport> {
  console.log('[protocol-value] generating report');

  const [usdcAddress, treasuryAddress, oracleAddress, yieldPool, reporterBps, minWin, maxWin] =
    await Promise.all([
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'usdc' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'treasury' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'oracle' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'yieldPoolBalance' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'reporterSlashBps' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'minWindowDuration' }),
      basePublicClient.readContract({ address: contractAddress, abi: gitLedgerAbi, functionName: 'maxWindowDuration' }),
    ]);

  const [contractBalance, treasuryBalance] = await Promise.all([
    basePublicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [contractAddress],
    }),
    basePublicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [treasuryAddress as `0x${string}`],
    }),
  ]);

  const yieldPoolBn = yieldPool as bigint;
  const contractBalanceBn = contractBalance as bigint;
  const activeEscrowBn = contractBalanceBn > yieldPoolBn ? contractBalanceBn - yieldPoolBn : 0n;

  const byStateRows = await db
    .select({
      state: stakes.state,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${stakes.amountUsdc}),0)::text`,
    })
    .from(stakes)
    .groupBy(stakes.state);

  const totalsMicro = { active: '0', slashed: '0', clean: '0', pendingStake: '0' };
  for (const row of byStateRows) {
    if (row.state === 'active') totalsMicro.active = row.total;
    else if (row.state === 'slashed') totalsMicro.slashed = row.total;
    else if (row.state === 'clean') totalsMicro.clean = row.total;
    else if (row.state === 'pending_stake') totalsMicro.pendingStake = row.total;
  }

  const report: ProtocolValueReport = {
    network: { chainId: 8453, rpcUrl: env.BASE_RPC_URL },
    contract: {
      address: contractAddress,
      usdc: usdcAddress as `0x${string}`,
      treasury: treasuryAddress as `0x${string}`,
      oracle: oracleAddress as `0x${string}`,
      reporterSlashBps: Number(reporterBps),
      minWindowDurationSeconds: (minWin as bigint).toString(),
      maxWindowDurationSeconds: (maxWin as bigint).toString(),
    },
    treasury: {
      address: treasuryAddress as `0x${string}`,
      usdcBalanceMicro: (treasuryBalance as bigint).toString(),
      usdcBalanceFormatted: formatUsdc(treasuryBalance as bigint),
    },
    protocolEscrow: {
      contractUsdcBalanceMicro: contractBalanceBn.toString(),
      contractUsdcBalanceFormatted: formatUsdc(contractBalanceBn),
      yieldPoolMicro: yieldPoolBn.toString(),
      yieldPoolFormatted: formatUsdc(yieldPoolBn),
      activeStakeEscrowMicro: activeEscrowBn.toString(),
      activeStakeEscrowFormatted: formatUsdc(activeEscrowBn),
    },
    stakes: {
      byState: byStateRows.map((r) => ({
        state: r.state ?? 'unknown',
        count: r.count,
        totalUsdcMicro: r.total,
        totalUsdcFormatted: formatUsdc(BigInt(r.total)),
      })),
      totalsMicro,
    },
    generatedAt: new Date().toISOString(),
  };

  console.log('[protocol-value] report ready', {
    contractBalance: report.protocolEscrow.contractUsdcBalanceFormatted,
    treasuryBalance: report.treasury.usdcBalanceFormatted,
    yieldPool: report.protocolEscrow.yieldPoolFormatted,
  });

  return report;
}
