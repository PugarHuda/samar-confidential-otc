# Submit-Form Text — Zama Developer Program (Season 3)

> Copy-paste per field into the submission form. Three separate submissions.
> Only `[video link]` is still a placeholder — fill after recording. Everything else is final.

Shared across all three:
- **Repo:** https://github.com/PugarHuda/samar-confidential-otc
- **Chain:** Sepolia testnet
- **Suite hub:** https://samar-hub.vercel.app
- **Builder wallet:** 0x39D2bae5EAedA9283535dDC98F1991c81eD5Cd7E

---

## Submission 1 — Samar (Builder Track, $7k)

**Project name:** Samar — Confidential OTC Desk

**Tagline:** An on-chain OTC desk / dark pool where order size, price, and the maker's hidden reserve stay encrypted end to end — trustless atomic settlement, no middleman.

**Demo URL:** https://samar-otc.vercel.app

**Video:** [video link]

**Description:**
Whales don't trade on public DEXs — one large order and bots front-run it, the market moves against you, and competitors read your position. That's why big trades go OTC through a trusted desk. Samar removes the trust and keeps the privacy.

Samar is a confidential OTC desk built on Zama fhEVM. Order amounts and the maker's reserve price are encrypted client-side before they touch the chain; the smart contract computes on the ciphertext — checking whether a taker's offer clears the hidden reserve and moving both legs — without ever decrypting. Two modes: **Direct** (trustless atomic swap, both legs move or both refund in one tx) and **RFQ** (sealed-bid Vickrey auction, second-price, with an enforced reserve floor and a single provable winner). Settlement is fully on-chain — no off-chain gateway to trust — and never reverts on a secret condition, so a rejected trade is indistinguishable from a fill on-chain (no info leak). `allowedTaker` locks a trade to a KYC'd counterparty, putting compliance in the contract — built for RWA and institutional flow.

**Stack:** Solidity + `@fhevm/solidity` (euint64, FHE.select), OpenZeppelin ERC-7984 confidential tokens, Next.js + wagmi + Zama Relayer SDK.

**Deployed & Etherscan-verified (Sepolia):**
- PrivateOTC: `0x1F44777bDfab49fC2D616C29813142b98b91cd78`
- cUSDC: `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e`
- cETH: `0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c`

**Verify live:** `packages/contracts/scripts/e2e-settle.ts` runs a full Direct settle + RFQ Vickrey second-price on Sepolia. 21/21 contract tests pass.

---

## Submission 2 — Confidential Wrapper Registry (Bounty Track, $3k)

**Project name:** Confidential Wrapper Registry

**Tagline:** The on-ramp for confidential tokens — wrap any ERC-20 into a private ERC-7984 balance, unwrap back, and decrypt yours; every wrapper pair on Sepolia in one dashboard.

**Demo URL:** https://samar-wrapper.vercel.app

**Video:** [video link]

**Description:**
ERC-7984 hides your balance on-chain — but you need a way in and out. This app reads Zama's official Wrappers Registry live and lists every ERC-20 ↔ ERC-7984 pair on Sepolia (9 today: USDC, USDT, WETH, XAUt, tGBP…). For each pair: a faucet, one-click wrap, unwrap, and a decrypt button that reveals your confidential balance locally (only you hold the key). Wrap is instant; unwrap requests a Gateway finalization that returns your ERC-20. Frontend-only — it talks straight to the deployed registry and wrappers, no custom contracts.

**Stack:** Next.js + `@zama-fhe/sdk` v3 (Relayer), ERC-7984, wagmi. Registry `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`.

**Verify live:** `packages/wrapper/scripts/smoke-unshield.mjs` runs a full unwrap → Gateway finalize → ERC-20 returned round-trip on Sepolia.

---

## Submission 3 — Confidential Airdrop (Special Bounty · TokenOps, $2.5k)

**Project name:** Confidential Airdrop

**Tagline:** Encrypted token distribution — the pool and every recipient's allocation stay encrypted; only each recipient can read their share.

**Demo URL:** https://samar-airdrop.vercel.app

**Video:** [video link]

**Description:**
Every airdrop today leaks who got how much — inviting sybil farming, MEV, and cap-table snooping. This app keeps distribution confidential end to end: (1) admin funds a campaign with an FHE-encrypted pool, (2) for each recipient the admin encrypts an allocation bound to that address and signs it (EIP-712), (3) the recipient claims — receiving an ERC-7984 confidential balance — and decrypts only their own share. No observer, recipient, bot, or validator can read who got what.

**Stack:** `@tokenops/sdk/fhe-airdrop` + `@zama-fhe/sdk` v3 + ERC-7984, on Sepolia. A thin encryptor adapter bridges the TokenOps `{handles, inputProof}` shape to the Zama SDK v3 `{encryptedValues, inputProof}` output (`packages/airdrop/lib/tokenops.ts`).

**Verify live:** `packages/airdrop/scripts/smoke.mjs` runs the full create + fund → authorize → claim → decrypt flow with a real claim tx on Sepolia.
