import { sepolia } from "wagmi/chains";

export const CHAIN = sepolia;
export const SEPOLIA_CHAIN_ID = 11155111;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const ADDRESSES = {
  cUSDC: (process.env.NEXT_PUBLIC_CUSDC ?? "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e") as `0x${string}`,
  pool: (process.env.NEXT_PUBLIC_POOL ?? ZERO) as `0x${string}`,
  yieldSource: (process.env.NEXT_PUBLIC_YIELD ?? ZERO) as `0x${string}`,
};

export const isConfigured = ADDRESSES.pool !== ZERO;

// ERC-7984 operator approval expiry (uint48 seconds). Far future for the demo.
export const OPERATOR_UNTIL = 2_000_000_000;

// cUSDC uses 6 decimals: UI works in whole tokens, chain works in units.
export const DECIMALS = 1_000_000;
export const toUnits = (tokens: string): bigint => BigInt(Math.round(Number(tokens) * DECIMALS));
export const fmtUnits = (units: bigint, dp = 2): string =>
  (Number(units) / DECIMALS).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const FAUCET_TOKENS = 1000; // one faucet click = 1,000 cUSDC

export const validAmount = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000;
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const DRAW_STATE = ["Open", "Awaiting seed", "Selecting winners"] as const;

export const ETHERSCAN = "https://sepolia.etherscan.io";
