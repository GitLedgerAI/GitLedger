import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../config/env';

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(env.BASE_RPC_URL),
});

const privateKey = env.SIGNER_PRIVATE_KEY.startsWith('0x')
  ? (env.SIGNER_PRIVATE_KEY as `0x${string}`)
  : (`0x${env.SIGNER_PRIVATE_KEY}` as `0x${string}`);

export const signerAccount = privateKeyToAccount(privateKey);

export const baseWalletClient = createWalletClient({
  account: signerAccount,
  chain: base,
  transport: http(env.BASE_RPC_URL),
});
