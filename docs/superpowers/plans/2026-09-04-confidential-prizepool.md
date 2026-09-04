# Confidential PrizePool ("Samar Saving") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confidential PoolTogether for the Zama Season 4 bounty — no-loss prize savings where deposits, balances, TWAB weights, winnings AND the winner's identity stay encrypted; draws are onchain, FHE-random, deposit-time-weighted, and publicly verifiable.

**Architecture:** One main contract `ConfidentialPrizePool` that IS an ERC-7984 (the pool share = transferable confidential "prize ticket"). TWAB (time-weighted average balance) accounting in encrypted euint128 accumulators updated in the `_update` hook. Draws are a 3-phase state machine: `startDraw` (snapshot + `makePubliclyDecryptable` of total weight) → `seedDraw` (KMS-proof-verified total via `FHE.checkSignatures`, per-tier `FHE.rem(FHE.randEuint128(), W)`) → paginated `drawPage` loops (encrypted cumulative-sum winner selection, winnings credited via `FHE.select` to EVERY participant so the winner is never revealed). `MockYieldSource` mints mock yield into the prize reserve; sponsors can top up confidentially.

**Tech Stack:** Solidity 0.8.27, @fhevm/solidity 0.11, OZ confidential-contracts 0.5.1 (ERC7984), hardhat + @fhevm/hardhat-plugin mock tests, Next.js frontend (scaffold copied from packages/wrapper), @zama-fhe/relayer-sdk 0.4 (existing `lib/fhe.ts` + new publicDecrypt), Sepolia.

**Spec:** the bounty brief (conversation) + idea list Tier 1–4. Existing reusable code: `packages/contracts` (patterns from PrivateOTC.sol), `SamarCToken` = cUSDC faucet token already deployed at `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e`.

## Global Constraints

- HCU cap per tx: measured on Sepolia ≈16 FHE ops/entity is the safe per-tx loop budget (PrivateOTC MAX_BIDDERS=5 evidence). Draw page cap: `MAX_PAGE = 4` participants/tx (~20 ops each).
- Never revert on an encrypted condition (Strategy B): withdraw-too-much burns 0; losers "win" 0.
- Winner guaranteed per tier: `r ∈ [0, W-1]`, first participant with `cumsum > r` wins; final cumsum = W > r always.
- Leakage (deliberate, documented): per-draw total weight W (public after seed), participant list & count, tx timing, mock-yield amount. NOT leaked: deposits, balances, individual weights, winner identity, prize split recipients, sponsor amounts.
- Solidity settings: viaIR, optimizer 800, same as existing config.
- Commits end with Co-Authored-By + Claude-Session per repo convention.

---

### Task 1: ConfidentialPrizePool.sol
**Files:** Create `packages/contracts/contracts/ConfidentialPrizePool.sol`
Core: ERC7984("Samar Prize Ticket","SPT"), `deposit`, `withdraw`, `exit`, `sponsorPrize` (ext-handle + plaintext overload), TWAB in `_update` override (freeze when draw active), 3-phase draw, `claim`, Chainlink `checkUpkeep`/`performUpkeep`, view handles for user decryption (balance inherited, twab, checkpoint, winnings), draw history events.

### Task 2: MockYieldSource.sol
**Files:** Create `packages/contracts/contracts/MockYieldSource.sol`
Notional principal + APR bps, `harvest()` mints accrued cUSDC (SamarCToken open faucet) and sponsors the pool via plaintext sponsorPrize. Constructor does `setOperator(pool, max)`.

### Task 3: Mock tests
**Files:** Create `packages/contracts/test/ConfidentialPrizePool.ts`
Cover: deposit/decrypt/withdraw no-loss, over-withdraw no-op, ticket transfer, TWAB ratios (decrypt own handles), full draw cycle (fhevm.publicDecrypt → seedDraw proof → pages), Σwinnings == Σprizes, single-depositor-wins-all determinism, pagination (6 users, 2 pages), freeze during draw, claim resets, W=0 cancels, sequential draws with checkpoint reset, sponsor confidential.

### Task 4: Deploy + e2e on Sepolia
**Files:** Create `packages/contracts/scripts/deploy-pool.ts`, `packages/contracts/scripts/e2e-pool.ts`, `packages/contracts/scripts/keeper-pool.ts`
Reuse deployed cUSDC. Draw period 600s for demo. e2e: mint → deposit → sponsor → harvest → full draw crank → claim → withdraw, asserted on decrypted balances. Keeper: idempotent crank loop (harvest/start/seed/pages). Verify contracts on Etherscan.

### Task 5: Frontend packages/pool
**Files:** Copy scaffolding from `packages/wrapper` (package.json, config, tailwind, app shell), reuse `packages/web/lib/fhe.ts` + add `publicDecryptWithProof`. New page: hero + countdown + pool stats, faucet/deposit/withdraw card, my-balance + odds meter (EIP-712 decrypt), draw crank panel (anyone can advance), winnings reveal + confetti + claim, draw history table (winner column 🔒), verify-fairness section, Gate/network/error handling reused.

### Task 6: Automation
**Files:** Create `.github/workflows/pool-keeper.yml` (cron every 15 min runs keeper-pool.ts with repo secret PRIVATE_KEY), plus Chainlink Automation compatibility already in contract; README documents both.

### Task 7: Docs + submission
**Files:** Create `packages/pool/README.md`, `packages/contracts/docs or root README section`, `submission/prizepool-*` (video script, X thread), root README table row.
Confidentiality design & leakage doc, rejected zero-leak alternative (256-bit cross-mul) with reasoning, real-yield plug-in path (ERC7984 wrapper + Aave), HCU math, no-loss invariant proof sketch.
