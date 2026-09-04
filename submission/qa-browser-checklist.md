# Browser QA Checklist (≈2 min) — run once before submitting / while recording

**Setup:** MetaMask on **Sepolia**, a little Sepolia ETH for gas ([faucet](https://sepoliafaucet.com)).
The OTC contract is already seeded with 7 demo intents, so you can test as a *taker* without creating anything.
Each step is **action → expect**. If any "expect" is wrong, screenshot it and send it over.

---

## A. Samar OTC — `samar-otc.vercel.app` (the hero, do this first)

1. **Open `/app`** → expect the orderbook lists **7 intents** (not empty, no "couldn't load" error).
2. **Faucet** (`/app/faucet`) → mint cUSDC and cETH → expect balances appear after the tx.
3. **Filter Mode = Direct, Status = Open** → open one that is **not** locked → click **Accept**,
   offer `10000` → expect the "Atomic settlement" overlay, then **Settled**. Check `/app` Portfolio →
   **Decrypt** → expect your cETH went up (only you can read it).
4. **Verify the lock fix:** open the **locked** intent (yellow 🔒 "locked" chip in the list, intent #2) →
   expect a **"LOCKED_INTENT"** panel explaining you're not the allowed taker — **NOT** an Accept form.
5. **Verify an RFQ:** open an **RFQ · Open** intent → submit a small bid → expect "bid is in".
   Open the **RFQ · Filled** one → expect the "SETTLED" panel.
6. **Wrong-network guard:** switch MetaMask to Ethereum Mainnet → expect a **"Switch to Sepolia"** banner.

> Accepting an intent fills it (good for the video). After you accept one Direct, **one Direct + two RFQ**
> intents remain Open for judges. Want a fresh full set afterward? re-run `scripts/seed.ts`.

## B. Wrapper — `samar-wrapper.vercel.app`

7. Connect → expect the registry lists its pairs (**9** at time of writing). Pick USDC → **Faucet** → **Wrap** `100`.
8. Click **Decrypt** on the confidential balance → expect a real number, **no "Cannot convert… BigInt" crash**
   (this was a fixed bug). Optionally **Unwrap** → expect the Gateway finalization flow.

## C. Airdrop — `samar-airdrop.vercel.app`

9. Connect → **Mint cUSDC + authorize** → **Create + fund** a campaign (pool `1000`).
10. **Verify the input guards:** clear the Pool field or type `abc`/`10.5` → click Create →
    expect a friendly *"must be a whole number"* error, **not** a raw `BigInt(NaN)` crash.
11. **Verify the network guard:** switch MetaMask off Sepolia → expect a **"Wrong network"** banner and
    disabled buttons (this guard was newly added).

---

### If everything passes
All three apps are demo-ready. Record the OTC walkthrough (`submission/video-script.md`), then paste the
video URL into `submission/submit-form.md` + the X threads, and submit.

## E. Samar Saving (S4 pool) — `samar-pool.vercel.app` (do this before recording the S4 video)

The pool is live-seeded: 3 savers, 2+ completed draws in the history, a keeper cranking every 15 min
(once the `KEEPER_PRIVATE_KEY` repo secret is set — otherwise crank from the app buttons).

1. **Open the app** → expect the stats strip: countdown ticking, "Savers ≥ 3", prize reserve shows
   blurred ciphertext 🔒, mock APR "10.0%", draw history table has rows with winners = "🔒 encrypted".
2. **Faucet +1,000** → confirm tx → then **Deposit** `500` → expect two txs the first time
   (operator approval + deposit), then "✓ done". Savers count +1 within ~10s.
3. **Decrypt my numbers** → sign the EIP-712 prompt → expect wallet cUSDC, tickets = 500.00,
   a nonzero draw weight after a minute, and an odds %.
4. **Withdraw** `100` → expect "✓ done"; decrypt again → tickets 400.00 (no-loss path works).
5. **Draw engine:** when the countdown hits zero, click **Start draw now** → tx confirms → panel moves
   to phase 2 → **Relay randomness seed** (takes ~10-20s fetching the KMS proof) → phase 3 →
   **Advance selection** until it completes → history gains a row. If the keeper beats you to it,
   that's fine — it proves automation; deposit and wait for the next 10-min draw to crank one yourself.
6. **Winnings → Reveal** → expect either "0.00 — not this time" or 🏆 + confetti; if you won, **Claim**
   → decrypt wallet balance → it went up.
7. **Withdraw all** → expect tickets 0, principal fully back in the wallet.
8. **Wrong-network guard:** switch to Mainnet → expect the "Switch to Sepolia" panel.
9. **Frozen-draw guard (optional):** try depositing while phase 3 is running → expect the friendly
   "draw is running — unlocks in a few seconds" message, not a raw revert.

> Tip for the video: with 3 seeded savers + you, your odds won't be 100% — a "0.00 — not this time"
> reveal is also a GREAT shot (proves winner-blindness); you can run two draws and likely win once
> with a big-enough deposit (the seeded savers hold 1.1k-2.5k cUSDC).
