# Samar — Confidential OTC Desk on Zama fhEVM

> **Samar** (Indonesian: *obscured / unreadable*) is an on-chain OTC desk where **order size, price, and the maker's hidden reserve stay encrypted end-to-end** — from intent creation through atomic settlement. The chain verifies the deal; nobody — not counterparties, not bots, not validators — can read the numbers.

**Positioning:** a confidential **dark pool / OTC desk for tokenized RWA and institutional flow** — exactly where leaking order size and price is unacceptable. Permissioned trades are first-class: an intent can be **locked to a single KYC'd counterparty** (`allowedTaker`), so who-may-trade rules live *in the contract* — matching Zama's programmable-compliance model.

Built for the **Zama Developer Program — Builder Track (Mainnet Season 3)**. Deploys to **Sepolia**.

**🔗 Live demo:** https://samar-otc.vercel.app  ·  **Code:** https://github.com/PugarHuda/samar-confidential-otc

## This repo ships three confidential-finance apps on Zama

| App | What it is | Track | Live |
|---|---|---|---|
| **Samar** — `packages/web` | Confidential OTC desk (Direct + RFQ Vickrey) — documented below | Builder ($7k) | https://samar-otc.vercel.app |
| **Wrapper Registry** — `packages/wrapper` | Every ERC-20 ↔ ERC-7984 wrapper on Sepolia — wrap/unwrap/decrypt/faucet | Bounty ($3k) | https://samar-wrapper.vercel.app |
| **Confidential Airdrop** — `packages/airdrop` | Encrypted token distribution on the TokenOps SDK — flow verified live | Special Bounty ($2.5k) | https://samar-airdrop.vercel.app |

All three are surfaced at the **suite hub → https://samar-hub.vercel.app**. The rest of this README documents **Samar** (the OTC desk).

## Live on Sepolia

| Contract | Address |
|---|---|
| **PrivateOTC** | [`0xeC9db6251178EB090f436Fb0667Ace390adA2617`](https://sepolia.etherscan.io/address/0xeC9db6251178EB090f436Fb0667Ace390adA2617) |
| cUSDC (SamarCToken) | [`0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e`](https://sepolia.etherscan.io/address/0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e) |
| cETH (SamarCToken) | [`0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c`](https://sepolia.etherscan.io/address/0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c) |

> ✅ All three contracts are **verified on Sepolia Etherscan** — click any address to read the exact Solidity (`FHE.select` settlement, Vickrey loop, ACL).

**Verified end-to-end on Sepolia** via `packages/contracts/scripts/e2e-settle.ts` — a full **Direct** trade (both legs swap, amounts stay encrypted) and a 2-bidder **RFQ Vickrey** auction (winner charged the **second** price and refunded the overpay; loser refunded in full), asserted on decrypted balances. The complete confidential-trade lifecycle — encrypt → create → accept / bid → `finalizeAuction` — runs on the real relayer + coprocessor. See live settlement activity on [PrivateOTC · Sepolia Etherscan](https://sepolia.etherscan.io/address/0xeC9db6251178EB090f436Fb0667Ace390adA2617).

---

## Why this exists

Whales and treasuries avoid public DEXs for large trades because everything leaks: order size invites **front-running / MEV**, visible size causes **market impact**, and exposed positions are **information leakage** to competitors. Traditional OTC desks fix privacy by adding a **trusted middleman**.

Samar removes the middleman. The blockchain enforces settlement while **Fully Homomorphic Encryption (FHE)** keeps every amount encrypted — the exact problem FHE is built for.

## What makes it different

Prior confidential-OTC attempts on Zama stop at "post an encrypted request." Their settlement is a boolean flag flipped by a **trusted off-chain gateway that isn't even implemented** — so the trustless premise leaks. Samar's differentiators, all **on-chain and verified by tests**:

| Feature | Samar |
|---|---|
| **Atomic two-sided settlement** | ✅ both legs swap (or both refund) in one tx, amounts encrypted |
| **Hidden reserve** (`minBuyAmount`) | ✅ maker's floor price stays encrypted; taker offers blind |
| **Strategy B** (privacy on rejection) | ✅ never reverts on a secret; a too-low offer is a no-op refund, status always `Filled` |
| **Counterparty-scoped view** | ✅ `grantView` lets one chosen taker decrypt terms before committing |
| **Compliance-gated / permissioned** | ✅ `allowedTaker` locks a fill to one KYC'd address — who-may-trade rules in the contract |
| Trusted gateway | ❌ none — settlement is pure on-chain FHE |

### How settlement stays fair without revealing anything
ERC-7984's `confidentialTransferFrom` moves `min(requested, balance)` — on a shortfall it moves `0` (no partial). So the taker's payment is exactly the offer or exactly zero. `FHE.select` then routes funds branchlessly:

```solidity
ebool ok = FHE.ge(paid, it.minBuyAmount);          // offer clears the hidden reserve?
_payout(buyToken,  maker,  FHE.select(ok, paid, 0));        // ok → maker paid
_payout(sellToken, taker,  FHE.select(ok, sellAmount, 0));  // ok → taker gets asset
_payout(buyToken,  taker,  FHE.select(ok, 0, paid));        // else refund taker
_payout(sellToken, maker,  FHE.select(ok, 0, sellAmount));  // else return asset to maker
it.status = Status.Filled;                          // ALWAYS Filled — real vs no-op stays encrypted
```

Escrow nets to zero on every path. A rejection is indistinguishable from a fill on-chain.

---

## Monorepo layout

```
.
├── packages/
│   ├── contracts/          # Hardhat + Zama fhEVM (Solidity 0.8.27)
│   │   ├── contracts/
│   │   │   ├── PrivateOTC.sol      # the OTC desk (Direct + RFQ Vickrey)
│   │   │   └── SamarCToken.sol     # ERC-7984 demo token (deploy as cUSDC + cETH)
│   │   ├── test/PrivateOTC.ts      # settlement tests with real balance assertions
│   │   └── scripts/deploy.ts
│   └── web/                # Next.js App Router + Tailwind + wagmi/RainbowKit + Relayer SDK
│       ├── app/            # landing (/) + dark app (/app/*)
│       ├── components/     # UI kit, AppShell, landing
│       └── lib/            # config, ABIs, FHE (encrypt / user-decrypt), on-chain hooks
└── README.md
```

Tech: `@fhevm/solidity` ^0.11, OpenZeppelin `confidential-contracts` (ERC-7984), `@zama-fhe/relayer-sdk` ^0.4, Next.js 14, wagmi v2 / viem v2 / RainbowKit v2, Tailwind.

---

## Setup

### 1. Contracts
```bash
cd packages/contracts
npm install
npm test                 # 8 passing — Direct + RFQ Vickrey settlement, with real balance assertions
```

Deploy to Sepolia:
```bash
cp .env.example .env      # set PRIVATE_KEY (funded with Sepolia ETH) + SEPOLIA_RPC_URL
npm run deploy:sepolia    # prints cUSDC / cETH / PrivateOTC addresses
```

### 2. Frontend
```bash
cd packages/web
npm install
cp .env.example .env.local
# set NEXT_PUBLIC_CUSDC / NEXT_PUBLIC_CETH / NEXT_PUBLIC_PRIVATE_OTC from the deploy output
# set NEXT_PUBLIC_WALLETCONNECT_ID (free: https://cloud.walletconnect.com)
npm run dev               # http://localhost:3000
```

Demo flow: **Faucet** (mint + authorize both tokens) → **Create Intent → Direct** (sell cETH, hidden cUSDC reserve) → open a second wallet → **Active Intents → Accept** → settle. Then **Portfolio → Decrypt** to see balances move while the chain shows only ciphertext.

---

## Status: honest scope

- ✅ **Live now** — **Direct OTC** (encrypted intents, hidden reserve, counterparty-scoped view grants, atomic Strategy-B settlement, cancel) and **RFQ** (sealed-bid **Vickrey** second-price auctions, up to 10 bidders — highest bidder wins and pays the second price, all on encrypted handles).
- 🗺 **Coming soon** — partial fills, compliance-gated fills (allowlist / KYC), auction reserve floors.

> Note: RFQ `finalizeAuction` runs FHE ops per bidder; practical for a handful of bidders on Sepolia, `MAX_BIDDERS = 10`.

---

## Submission checklist (deadline: July 7, 23:59 AOE)

- [ ] Contracts deployed on Sepolia (addresses in web `.env.local`)
- [ ] Frontend deployed (Vercel) — set the same `NEXT_PUBLIC_*` env vars in the Vercel project
- [ ] **3-min video** — real-person pitch (AI voice/video disqualifies). Nail the money shot: Sepolia explorer showing the amount as **ciphertext** while the swap still settles.
- [ ] **X thread / article** introducing Samar
- [ ] Submit repo + live demo URL

> ⚠️ Testnet demo only — the token faucet mint is open (no access control) by design.
```
