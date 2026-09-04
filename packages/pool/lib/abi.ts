// Hand-trimmed ABIs — only what the app calls.

export const tokenAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint64" }], outputs: [] },
  {
    type: "function",
    name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const poolAbi = [
  // deposit / withdraw / claim
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "exit", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "sponsorPrize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  // draw lifecycle
  { type: "function", name: "startDraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "seedDraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cleartexts", type: "bytes" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "drawPage", stateMutability: "nonpayable", inputs: [{ name: "count", type: "uint256" }], outputs: [] },
  // reads
  { type: "function", name: "drawState", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "drawId", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { type: "function", name: "nextDrawAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "drawCursor", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "participantCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastDrawTotalWeight", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "snapshotWeightHandle", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "snapshotTs", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "drawPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "tierCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tierBps", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint16" }] },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "winningsOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  { type: "function", name: "twabOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bytes32" }] },
  {
    type: "function",
    name: "twabCheckpointOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "twabLastOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint64" }],
  },
  // events (history)
  {
    type: "event",
    name: "DrawSeeded",
    inputs: [
      { name: "drawId", type: "uint32", indexed: true },
      { name: "totalWeight", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DrawCompleted",
    inputs: [
      { name: "drawId", type: "uint32", indexed: true },
      { name: "totalWeight", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DrawCancelled",
    inputs: [{ name: "drawId", type: "uint32", indexed: true }],
  },
] as const;

export const yieldAbi = [
  { type: "function", name: "accrued", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "aprBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { type: "function", name: "principal", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint64" }] },
] as const;
