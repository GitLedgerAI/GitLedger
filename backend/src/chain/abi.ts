export const gitLedgerAbi = [
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
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'treasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'oracle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'yieldPoolBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'reporterSlashBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'minWindowDuration',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'maxWindowDuration',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Minimal ERC20 ABI for balanceOf + decimals + symbol
export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;
