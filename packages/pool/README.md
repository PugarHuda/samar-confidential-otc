# Samar Saving — Confidential Prize Savings (PoolTogether on Zama fhEVM)

> No-loss prize savings where **nobody — not even the pool — knows who won.** Deposits, balances,
> odds, prizes and winners stay encrypted end to end; draws run on-chain with FHE randomness and
> are publicly verifiable.

Built for the **Zama Developer Program — Mainnet Season 4 Bounty** (Confidential PoolTogether).

**🔗 Live app:** https://samar-pool.vercel.app · part of the [Samar suite](https://samar-hub.vercel.app)

## Live on Sepolia (verified on Etherscan)

| Contract | Address |
|---|---|
| **ConfidentialPrizePool** | [`0xe7bFfFF46fAc9FBA8e2cF4265C65c16BAD47EA69`](https://sepolia.etherscan.io/address/0xe7bFfFF46fAc9FBA8e2cF4265C65c16BAD47EA69#code) |
| MockYieldSource | [`0x3a604f4eBB6F6057bB3200d1ac010fA3224bdbf5`](https://sepolia.etherscan.io/address/0x3a604f4eBB6F6057bB3200d1ac010fA3224bdbf5#code) |
| cUSDC (ERC-7984, open faucet) | [`0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e`](https://sepolia.etherscan.io/address/0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e#code) |

**Verified end-to-end on Sepolia** via `packages/contracts/scripts/e2e-pool.ts` — the full judged
cycle (encrypted deposit → confidential sponsorship → draw with on-chain FHE randomness and a
KMS-signature-verified seed → winner-blind claim → full-principal exit) ran against the real
coprocessor + relayer and was asserted on decrypted balances. No admin keys anywhere: the pool is
not ownable, not pausable, not upgradeable.

## Try it (judges)

1. Open https://samar-pool.vercel.app, connect a Sepolia wallet.
2. **Faucet +1,000** mints test cUSDC (the token is an open faucet — one click).
3. **Deposit** — approve-as-operator + encrypted deposit in one guided flow.
4. **Decrypt my numbers** — sign the EIP-712 user-decryption request; see your balance, tickets,
   time-weighted draw weight and estimated odds. Nobody else can.
5. Wait for the 10-minute draw (a GitHub Actions keeper cranks it; every phase button in the
   *Draw engine* panel is also permissionless — you can advance a pending draw yourself).
6. **Reveal** your winnings (decrypt), **Claim** if you won — confetti included.
7. **Withdraw / Withdraw all** — full principal back at any time. No loss.

## How the pool works

- Deposit cUSDC (ERC-7984 confidential token) → receive **Samar Prize Tickets (SPT) 1:1**. The
  pool contract *is itself an ERC-7984*: tickets are transferable confidential tokens, so your
  savings position composes with the rest of the confidential-DeFi stack (e.g. tradable on
  [Samar OTC](https://samar-otc.vercel.app)).
- Yield is sponsored into an **encrypted prize reserve**: the MockYieldSource accrues 10% APR on a
  notional principal and anyone can `harvest()` it in; anyone can also **sponsor confidentially**
  (nobody learns how much you added).
- Every 10 minutes a draw splits the reserve across **three tiers — 70% / 20% / 10%** — among
  savers, weighted by **encrypted TWAB** (time-weighted average balance). Prizes are credited to
  encrypted per-account winnings; principal is never touched.
- Withdraw any amount of principal at any time — including mid-period. (The only lock is the few
  seconds while a draw's selection pages run, so weights can't shift mid-draw.)

### Draw mechanics — on-chain, FHE-random, deposit-weighted, winner-blind

A draw is a 3-phase state machine (paginated to respect the per-transaction HCU budget):

1. **`startDraw()`** (permissionless, once due) — accrues and snapshots the pool's total weight
   for the period, and calls `FHE.makePubliclyDecryptable` on **that single aggregate only**.
2. **`seedDraw(cleartexts, proof)`** (permissionless) — any keeper fetches the KMS public
   decryption of the total weight `W` and relays it. The contract **verifies the KMS threshold
   signatures on-chain** (`FHE.checkSignatures`) — a forged total cannot pass — then draws each
   tier's threshold `r = FHE.randEuint128() % W`: **on-chain FHE randomness, uniform in
   [0, W-1], and encrypted**. No off-chain RNG, no oracle to bribe.
3. **`drawPage(n)`** (permissionless, ≤3 savers per tx) — walks savers accumulating an encrypted
   cumulative sum of weights. For each tier, the **first saver whose cumsum exceeds the encrypted
   threshold wins** — evaluated entirely with `FHE.gt` / `FHE.and` / `FHE.select` over
   ciphertexts. Every walked saver's winnings are updated: winner gets `+prize`, everyone else
   `+0`. The updates are indistinguishable, so **the winner's identity never exists in plaintext
   anywhere** — not in state, not in events, not in calldata.

**Fairness invariants**

- `r ∈ [0, W-1]` and the final cumulative sum equals exactly `W`, so **exactly one winner per
  tier always exists**, with probability exactly `weight / W`.
- Weight is TWAB, not balance: depositing right before a draw earns ~zero weight — **draw
  sniping doesn't work**. Weights reset via per-account checkpoints each draw (no compounding
  advantage for early depositors).
- Zero-weight accounts mathematically cannot win (their cumsum step is zero).
- A period with zero total weight cancels cleanly: the prize rolls over.

**Claiming** is winner-blind too: *everyone* can `claim()`; losers transfer an encrypted 0,
winners their prize. The tx graph reveals nothing.

## Confidentiality design

**Encrypted, end to end** (euint64/euint128 + ERC-7984):
deposit & withdrawal amounts · ticket balances · per-account TWAB weights & odds · the prize
reserve · per-tier prize amounts · sponsorship amounts · per-account winnings · **winner
identities** (only the winner learns, by decrypting their own winnings).

**Deliberate, documented leakage:**

| Leak | Why | Severity |
|---|---|---|
| Per-draw total weight `W` | Bounds the FHE randomness (`FHE.rem` needs a plaintext modulus); decrypted once per draw, KMS-proof-verified | Comparable to public TVL — industry-normal |
| Participant list & count | Addresses that ever held tickets (already visible in the tx graph) | Amounts/weights stay hidden; zero-balance members indistinguishable |
| Tx timing & graph | Inherent to any public chain | Standard |
| Mock-yield harvest amounts | Real yield-strategy flows are public too | None beyond production reality |

**Considered and rejected — a fully zero-leak draw:** compare `cumsum · 2⁶⁴ > r · W` with both
sides encrypted, so `W` never needs decryption. With euint128 weights this needs 256-bit
encrypted multiplication — HCU cost per participant makes it impractical today. The design keeps
that door open (swap phase 2), and we chose the *minimal* disclosure: one aggregate per draw,
verified on-chain.

**HCU engineering:** selection costs ~20 FHE ops per saver per page (`MAX_PAGE = 3` per tx,
measured 787k gas/page live). Draws paginate across any number of savers — the cap bounds a
*transaction*, not the pool.

## Yield source — mock, and the real plug-in

`MockYieldSource` accrues linear interest (10% APR) on a notional principal and mints the accrual
from the faucet token into the pool via `sponsorPrizePlain()`. Sepolia has no dependable native
yield; the faucet stands in for a strategy's harvest.

**Production path:** funding the reserve is permissionless by design, so a real adapter drops in
without touching the pool — hold a strategy position (Aave/Morpho vault), harvest real yield,
wrap it into the confidential asset via its ERC-7984 wrapper, call the same `sponsorPrizePlain`.
Individual user accounting stays confidential throughout; only the strategy's aggregate position
is public, exactly as it is for every DeFi vault today.

## Automation

- **GitHub Actions keeper** (`.github/workflows/pool-keeper.yml`): every 15 min — harvest due
  yield, then advance whatever draw phase is pending (start → KMS seed relay → pages). Needs the
  `KEEPER_PRIVATE_KEY` repo secret (any funded Sepolia key; the crank is permissionless).
- **Chainlink Automation-compatible**: the pool implements `checkUpkeep` / `performUpkeep`
  (phases 1 & 3). Phase 2 needs the off-chain KMS relay, which the keeper — or any visitor via
  the app's *Draw engine* buttons — provides.

## Repo layout & scripts

```
packages/contracts/contracts/ConfidentialPrizePool.sol   the pool (ERC-7984 tickets + TWAB + draws)
packages/contracts/contracts/MockYieldSource.sol         mock yield → prize reserve
packages/contracts/test/ConfidentialPrizePool.ts         12 mock tests (full cycle, invariants)
packages/contracts/scripts/deploy-pool.ts                npm run deploy:pool
packages/contracts/scripts/e2e-pool.ts                   npm run e2e:pool   (full cycle, live Sepolia)
packages/contracts/scripts/keeper-pool.ts                npm run keeper:pool (idempotent crank)
packages/pool/                                           this Next.js app
```

```bash
# contracts
cd packages/contracts && npm i && npx hardhat test      # 33 tests (12 pool)
npm run deploy:pool && npm run e2e:pool                  # needs PRIVATE_KEY in .env

# app
cd packages/pool && npm i && npm run dev                 # addresses in .env.example
```

## Frontend integration notes

- `lib/fhe.ts` — Zama relayer SDK (`@zama-fhe/relayer-sdk` 0.4): WASM init, encrypted inputs with
  retry/timeout, **EIP-712 user decryption** of balances/weights/winnings, and
  `publicDecryptWithProof` for the trustless draw-seed relay.
- Errors handled in-app: missing operator approval (auto-fixed before deposit), wrong network
  (Gate), draw-frozen deposits, not-due draws, relayer timeouts (retries), rejected signatures.
