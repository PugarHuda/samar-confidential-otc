# Samar web — Confidential OTC desk

The Samar frontend: a marketing landing (`/`) plus the dark trading app (`/app/*`) for creating Direct and RFQ Vickrey intents, filling/bidding, and decrypting confidential balances. Full protocol writeup in the [root README](../../README.md).

**🔗 Live:** https://samar-otc.vercel.app

## Stack

Next.js 14 (App Router) · wagmi v2 / viem v2 / RainbowKit v2 · Tailwind · `@zama-fhe/relayer-sdk` 0.4 (client-side encrypt + user-decrypt, WASM) · Sepolia.

## Run

```bash
npm install
cp .env.example .env.local
# set NEXT_PUBLIC_CUSDC / NEXT_PUBLIC_CETH / NEXT_PUBLIC_PRIVATE_OTC (from the contracts deploy output)
# set NEXT_PUBLIC_WALLETCONNECT_ID (free at https://cloud.walletconnect.com; MetaMask works without)
npm run dev        # http://localhost:3000
```

The same `NEXT_PUBLIC_*` vars must be set in the Vercel project for the deployed build (they are inlined at build time). Current contracts are listed in [`packages/contracts/README.md`](../contracts/README.md).

## Layout

- `app/` — landing (`page.tsx`) + `app/app/*` routes (intents list, create/direct, create/rfq, faucet, portfolio, intent detail)
- `components/` — UI kit (`ui.tsx`), `AppShell`, `Gate`, landing atoms
- `lib/` — `config.ts` (addresses/env), `abi.ts`, `fhe.ts` (relayer encrypt / userDecrypt), `hooks.ts` (on-chain reads/writes)
