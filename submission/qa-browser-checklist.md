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

7. Connect → expect the registry lists **9 pairs**. Pick USDC → **Faucet** → **Wrap** `100`.
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
