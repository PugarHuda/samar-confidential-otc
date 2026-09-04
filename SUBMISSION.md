# Submissions — Zama Developer Program (Seasons 3 & 4)

Four confidential-finance apps on Zama fhEVM, one monorepo, all deployed and **verified live on Sepolia**.

Suite hub: https://samar-hub.vercel.app · Repo: https://github.com/PugarHuda/samar-confidential-otc

| # | App | Track | Live demo | Code | Video script | X thread |
|---|---|---|---|---|---|---|
| 1 | **Samar Saving** — confidential PoolTogether | **S4 Bounty ($5k)** | https://samar-pool.vercel.app | `packages/pool` | `submission/pool-video-script.md` | `submission/pool-x-thread.md` |
| 2 | **Samar** — confidential OTC desk | S3 Builder ($7k) | https://samar-otc.vercel.app | `packages/web` | `submission/video-script.md` | `submission/x-thread.md` |
| 3 | **Confidential Wrapper Registry** | S3 Bounty ($3k) | https://samar-wrapper.vercel.app | `packages/wrapper` | `submission/wrapper-video-script.md` | `submission/wrapper-x-thread.md` |
| 4 | **Confidential Airdrop** | S3 Special Bounty ($2.5k, TokenOps) | https://samar-airdrop.vercel.app | `packages/airdrop` | `submission/airdrop-video-script.md` | `submission/airdrop-x-thread.md` |

## Season 4 — Samar Saving (Confidential PoolTogether)
No-loss prize savings where **nobody — not even the pool — learns who won**: encrypted deposits/balances (ERC-7984 tickets), encrypted TWAB draw weights (no draw sniping), on-chain FHE randomness bounded by a KMS-signature-verified aggregate, winner-blind selection & claims, full principal withdrawable anytime, no admin keys. Full design + leakage doc: `packages/pool/README.md`.
- Contracts (verified): pool `0xe7bFfFF46fAc9FBA8e2cF4265C65c16BAD47EA69` · yield `0x3a604f4eBB6F6057bB3200d1ac010fA3224bdbf5` · cUSDC `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e`
- Live e2e (full judged cycle on real coprocessor): `packages/contracts/scripts/e2e-pool.ts`
- Automated draws: `.github/workflows/pool-keeper.yml` (needs `KEEPER_PRIVATE_KEY` repo secret) + Chainlink Automation-compatible + permissionless in-app crank

## One-line pitches
1. **Samar** — an on-chain OTC desk / dark pool where order size, price, and the maker's hidden reserve stay encrypted end to end; trustless atomic settlement (Direct) plus sealed-bid Vickrey auctions (RFQ). Permissioned trades (`allowedTaker`) put compliance in the contract.
2. **Wrapper Registry** — the on-ramp for confidential tokens: surfaces every ERC-20 ↔ ERC-7984 wrapper on Sepolia and lets anyone wrap, unwrap, decrypt balances, and faucet mocks.
3. **Confidential Airdrop** — encrypted token distribution on the TokenOps SDK: the pool and every recipient's allocation stay encrypted; only each recipient can read their share.

## Verified live on Sepolia (reproducible scripts)
- Samar settlement (Direct + RFQ Vickrey second-price): `packages/contracts/scripts/e2e-settle.ts`
- Samar relayer round-trip (encrypt → create → decrypt): `packages/contracts/scripts/e2e.ts`
- Wrapper wrap (mint → wrap → decrypt): `packages/contracts/scripts/e2e-wrap.ts`
- Wrapper unwrap → finalize (full round-trip, ERC-20 returned): `packages/wrapper/scripts/smoke-unshield.mjs`
- Airdrop (create+fund → authorize → claim → decrypt): `packages/airdrop/scripts/smoke.mjs`

## Threat model & known limitations
An honest scope of what the contract guarantees (fund safety, third-party + winner-identity confidentiality)
and where it doesn't (liveness/griefing trade-offs of the privacy design): `submission/threat-model.md`.

## Deployed contracts (Samar, Sepolia)
| Contract | Address |
|---|---|
| PrivateOTC | `0x1F44777bDfab49fC2D616C29813142b98b91cd78` |
| cUSDC (SamarCToken) | `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e` |
| cETH (SamarCToken) | `0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c` |

Wrapper & Airdrop talk to Zama's already-deployed Sepolia contracts (Wrappers Registry `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`; TokenOps airdrop factory resolved by the SDK).

## Per-submission checklist
For each of the three: [x] deployed demo (live on Vercel) · [ ] 3-min real-person video (scripts ready) · [ ] X thread (drafts ready) · [ ] submit repo + demo URL.

> Testnet only. Token faucets mint freely by design.
