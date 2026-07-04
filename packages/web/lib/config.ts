import { sepolia } from "wagmi/chains";

export const CHAIN = sepolia;
export const SEPOLIA_CHAIN_ID = 11155111;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const ADDRESSES = {
  cUSDC: (process.env.NEXT_PUBLIC_CUSDC ?? ZERO) as `0x${string}`,
  cETH: (process.env.NEXT_PUBLIC_CETH ?? ZERO) as `0x${string}`,
  privateOTC: (process.env.NEXT_PUBLIC_PRIVATE_OTC ?? ZERO) as `0x${string}`,
};

export type TokenMeta = {
  key: "cUSDC" | "cETH";
  address: `0x${string}`;
  symbol: string;
  glyph: string;
  color: string;
  faucet: number;
};

export const TOKENS: TokenMeta[] = [
  { key: "cUSDC", address: ADDRESSES.cUSDC, symbol: "cUSDC", glyph: "$", color: "#3E7BFA", faucet: 10000 },
  { key: "cETH", address: ADDRESSES.cETH, symbol: "cETH", glyph: "Ξ", color: "#8B7FF0", faucet: 10 },
];

export const tokenByAddress = (a: string): TokenMeta | undefined =>
  TOKENS.find((t) => t.address.toLowerCase() === a?.toLowerCase());

// ERC-7984 operator approval expiry (uint48 seconds). ~60-day+ / far future for the demo.
export const OPERATOR_UNTIL = 2_000_000_000;

export const isConfigured = ADDRESSES.privateOTC !== ZERO;

export const MODE = ["Direct", "RFQ"] as const;
export const STATUS = ["Open", "Pending Reveal", "Filled", "Cancelled", "Expired"] as const;

// Amounts are uint64 on-chain. Keep well under 2^53 so plain Number math stays exact for the demo.
export const MAX_AMOUNT = 1_000_000_000_000_000; // 1e15
export const validAmount = (s: string) => {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT;
};

export const zeroAddressIsOpen = (a?: string) => !a || a === "0x0000000000000000000000000000000000000000";

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const intentId = (id: number | bigint) => `#IX_${String(Number(id)).padStart(4, "0")}`;
