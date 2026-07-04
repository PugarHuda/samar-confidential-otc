import { parseAbi } from "viem";

// Official Zama Confidential Wrappers Registry on Sepolia.
export const REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" as const;
export const SEPOLIA_CHAIN_ID = 11155111;
export const OPERATOR_UNTIL = 2_000_000_000;

export const registryAbi = parseAbi([
  "function getTokenConfidentialTokenPairs() view returns ((address tokenAddress, address confidentialTokenAddress, bool isValid)[])",
  "function getTokenConfidentialTokenPairsLength() view returns (uint256)",
]);

// Zama ConfidentialWrapper (the ERC-7984 side listed in the registry).
export const wrapperAbi = parseAbi([
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
  "function underlying() view returns (address)",
  "function rate() view returns (uint256)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// Underlying public ERC-20 mock (open faucet mint, capped at 1,000,000 tokens).
export const erc20Abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export type Pair = {
  token: `0x${string}`; // underlying ERC-20
  cToken: `0x${string}`; // confidential ERC-7984 wrapper
  isValid: boolean;
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
