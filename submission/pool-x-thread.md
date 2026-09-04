# Samar Saving — X thread (Season 4 Bounty submission)

Tag @zama · #ZamaDeveloperProgram. Attach: hero screenshot (tweet 1), draw-engine/history screenshot (tweet 4), winnings-confetti screenshot (tweet 5).

---

**1/**
PoolTogether invented the no-loss lottery. But on a transparent chain it leaks everything: every deposit, everyone's odds, and exactly who won every draw.

We rebuilt it on @zama fhEVM so that nobody — not even the pool — knows who won. 🧵

Live on Sepolia: https://samar-pool.vercel.app

**2/**
Samar Saving = no-loss prize savings, fully confidential:

🔒 deposits & balances — encrypted (ERC-7984)
🔒 your odds — encrypted TWAB weights
🔒 the prize reserve & every prize — encrypted
🔒 the winners — encrypted. Only a winner learns, by decrypting their own winnings.

Withdraw full principal anytime. No loss.

**3/**
The draw is on-chain and provably fair:

1️⃣ snapshot the pool's total weight — the ONLY number a draw ever reveals (≈ public TVL)
2️⃣ anyone relays its KMS decryption; the contract verifies the KMS threshold signatures on-chain, then draws thresholds with FHE.randEuint128 — encrypted, on-chain randomness
3️⃣ encrypted cumulative sums pick the winners

Odds = exactly your time-weighted balance ÷ pool. No draw sniping (TWAB), no oracle, no admin keys.

**4/**
The winner-blind trick: after selection, EVERY saver's encrypted winnings get updated — winners with the prize, everyone else with +0. The writes are indistinguishable.

Claiming too: everyone can claim; losers transfer an encrypted 0.

The winner's identity never exists in plaintext. Anywhere.

**5/**
Everything runs live on Sepolia today:

✅ verified contracts, no admin keys
✅ 10-min draws, 3 prize tiers (70/20/10), auto-cranked by a keeper — or crank it yourself, it's permissionless
✅ EIP-712 user decryption for balances, odds & winnings
✅ full cycle verified e2e on the real coprocessor
✅ transferable confidential tickets (the pool IS an ERC-7984)

**6/**
Try it in 2 minutes: faucet → deposit → decrypt your odds → wait for the countdown → reveal → 🏆?

App: https://samar-pool.vercel.app
Code: https://github.com/PugarHuda/samar-confidential-otc (packages/pool)
Pool: https://sepolia.etherscan.io/address/0xe7bFfFF46fAc9FBA8e2cF4265C65c16BAD47EA69#code

Built for @zama Developer Program S4 #ZamaDeveloperProgram
