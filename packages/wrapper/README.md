# Confidential Wrapper Registry

A production-ready app that surfaces **every ERC-20 ↔ ERC-7984 wrapper pair** on Sepolia, lets you **wrap / unwrap**, **decrypt any ERC-7984 balance**, and includes a **faucet** for the official cToken mocks.

Built for the **Zama Developer Program — Bounty Track (Mainnet Season 3)**.

**🔗 Live:** https://samar-wrapper.vercel.app

## What it does

- **Reads the official registry** (`0x2f0750Bbb0A246059d80e94c454586a7F27a128e` on Sepolia) via `getTokenConfidentialTokenPairs()` and lists every valid pair (9 live at time of writing).
- **Faucet** — mints the underlying public ERC-20 mock (`mint(to, amount)`, capped at 1M).
- **Wrap** — `approve` the wrapper, then `wrap(to, amount)` to mint a confidential ERC-7984 balance.
- **Decrypt** — user-side decrypt of your `confidentialBalanceOf` via `@zama-fhe/sdk` v3 (only you can read it).
- **Unwrap** — via `@zama-fhe/sdk` v3 `WrappedToken.unshield`, which orchestrates the full two-phase flow (unwrap request → wait → public-decrypt → `finalizeUnwrap`) so the public ERC-20 actually returns to your wallet.

No custom contracts — the app talks directly to the official Zama registry, wrappers, and cToken mocks already deployed on Sepolia.

## Stack

Next.js (App Router) · wagmi v2 / viem v2 / RainbowKit · Tailwind · `@zama-fhe/sdk` v3 (`WrappedToken` shield/unshield + user-decrypt) · Sepolia.

## Run

```bash
npm install
cp .env.example .env.local   # optional: NEXT_PUBLIC_WALLETCONNECT_ID (MetaMask works without)
npm run dev                  # http://localhost:3000
```

## Notes

- Amounts are entered in **whole tokens** for both wrap (scaled by the ERC-20's decimals) and unwrap (scaled by the confidential token's decimals); non-integer or negative input is rejected up front. Confidential mocks cap at 6 decimals.
- Both halves are **verified live on Sepolia**: wrap (`../contracts/scripts/e2e-wrap.ts`) and the full unwrap→finalize round-trip (`scripts/smoke-unshield.mjs` — got the ERC-20 back). The raw `unwrap(...)` call is only a request that does not auto-finalize; the app uses `WrappedToken.unshield`, which drives the finalization for you.
