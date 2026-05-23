export const gitLedgerAbi = [
  {
    type: 'function',
    name: 'stakeReview',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'basename', type: 'bytes32' },
      { name: 'repoSlug', type: 'string' },
      { name: 'prId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'stakeId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'slashReview',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'bytes32' },
      { name: 'reporter', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'releaseYield',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'stakes',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'reviewer', type: 'address' },
      { name: 'basename', type: 'bytes32' },
      { name: 'repoSlug', type: 'string' },
      { name: 'prId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
      { name: 'attestationUID', type: 'bytes32' },
      { name: 'state', type: 'uint8' },
    ],
  },
] as const;
