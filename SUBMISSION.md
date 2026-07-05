# Submissions — Zama Developer Program, Mainnet Season 3

Three confidential-finance apps on Zama fhEVM, one monorepo, all deployed and **verified live on Sepolia**.

Suite hub: https://samar-hub.vercel.app · Repo: https://github.com/PugarHuda/samar-confidential-otc

| # | App | Track | Live demo | Code | Video script | X thread |
|---|---|---|---|---|---|---|
| 1 | **Samar** — confidential OTC desk | Builder ($7k) | https://samar-otc.vercel.app | `packages/web` | `submission/video-script.md` | `submission/x-thread.md` |
| 2 | **Confidential Wrapper Registry** | Bounty ($3k) | https://samar-wrapper.vercel.app | `packages/wrapper` | `submission/wrapper-video-script.md` | `submission/wrapper-x-thread.md` |
| 3 | **Confidential Airdrop** | Special Bounty ($2.5k, TokenOps) | https://samar-airdrop.vercel.app | `packages/airdrop` | `submission/airdrop-video-script.md` | `submission/airdrop-x-thread.md` |

## One-line pitches
1. **Samar** — an on-chain OTC desk / dark pool where order size, price, and the maker's hidden reserve stay encrypted end to end; trustless atomic settlement (Direct) plus sealed-bid Vickrey auctions (RFQ). Permissioned trades (`allowedTaker`) put compliance in the contract.
2. **Wrapper Registry** — the on-ramp for confidential tokens: surfaces every ERC-20 ↔ ERC-7984 wrapper on Sepolia and lets anyone wrap, unwrap, decrypt balances, and faucet mocks.
3. **Confidential Airdrop** — encrypted token distribution on the TokenOps SDK: the pool and every recipient's allocation stay encrypted; only each recipient can read their share.

## Verified live on Sepolia (reproducible scripts)
- Samar settlement (Direct + RFQ Vickrey second-price): `packages/contracts/scripts/e2e-settle.ts`
- Samar relayer round-trip (encrypt → create → decrypt): `packages/contracts/scripts/e2e.ts`
- Wrapper wrap (mint → wrap → decrypt): `packages/contracts/scripts/e2e-wrap.ts`
- Wrapper unwrap → finalize (full round-trip, ERC-20 returned): `packages/airdrop/scripts/smoke-unshield.mjs`
- Airdrop (create+fund → authorize → claim → decrypt): `packages/airdrop/scripts/smoke.mjs`

## Deployed contracts (Samar, Sepolia)
| Contract | Address |
|---|---|
| PrivateOTC | `0xeC9db6251178EB090f436Fb0667Ace390adA2617` |
| cUSDC (SamarCToken) | `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e` |
| cETH (SamarCToken) | `0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c` |

Wrapper & Airdrop talk to Zama's already-deployed Sepolia contracts (Wrappers Registry `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`; TokenOps airdrop factory resolved by the SDK).

## Per-submission checklist
For each of the three: [ ] deployed demo · [ ] 3-min real-person video (scripts ready) · [ ] X thread (drafts ready) · [ ] submit repo + demo URL.

> Testnet only. Token faucets mint freely by design.
