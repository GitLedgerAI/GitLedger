import { erc20Abi } from 'viem';

export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const GITLEDGER_CONTRACT =
  (process.env.NEXT_PUBLIC_CODELEDGER_CONTRACT as `0x${string}` | undefined) ??
  '0x0eCc198f69Bb0334A73250BC672FD157E13A87cc';

export const USDC_ABI = erc20Abi;

export const MAX_UINT256 = 2n ** 256n - 1n;

export const GITLEDGER_ABI = [
  {
    type: 'function',
    name: 'stakeReview',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'bytes32' },
      { name: 'reviewer', type: 'address' },
      { name: 'principal', type: 'uint256' },
      { name: 'windowDuration', type: 'uint256' },
      { name: 'yieldBps', type: 'uint16' },
      { name: 'schemaData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'slashReview',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'bytes32' },
      { name: 'reporter', type: 'address' },
      { name: 'schemaData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'releaseYield',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'bytes32' },
      { name: 'schemaData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;
