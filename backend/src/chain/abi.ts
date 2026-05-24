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
] as const;
