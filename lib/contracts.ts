import { erc20Abi } from 'viem';

export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const GITLEDGER_CONTRACT =
  (process.env.NEXT_PUBLIC_CODELEDGER_CONTRACT as `0x${string}` | undefined) ??
  '0x0eCc198f69Bb0334A73250BC672FD157E13A87cc';

export const USDC_ABI = erc20Abi;

export const MAX_UINT256 = 2n ** 256n - 1n;
