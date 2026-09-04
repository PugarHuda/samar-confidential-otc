# Samar Saving — Video Script (Season 4 Bounty · Confidential PoolTogether · $5k)

Real-person pitch (required — no AI voice, normal speed). ≤ 3 minutes.
Live: https://samar-pool.vercel.app
Must show (per brief): deposit → decrypt pool balance → a draw being triggered → claim → withdraw principal, plus how winner selection stays fair *and* confidential.

Before recording: MetaMask on **Sepolia** with a little test ETH. Ideally time the recording so a
draw comes due mid-video (countdown < 3 min when you start), or pre-arrange a second wallet that
already deposited so the draw has weight. The Draw engine buttons let YOU trigger every phase on
camera — you don't need to wait for the keeper.

**0:00 Hook** — [SHOW] the live app, stats strip with the countdown.
(SAY) "PoolTogether invented the no-loss lottery: save together, the yield becomes prizes, withdraw your money anytime. But on a public chain it leaks everything — every deposit, everyone's odds, and exactly who won every draw. Winners become targets. This is Samar Saving: the same no-loss prize savings, on Zama's fhEVM, where nobody — not even the pool itself — knows who won."

**0:25 Deposit (real tx)** — [SHOW] Faucet +1,000 → confirm; type 500 → Deposit → confirm both txs (operator + deposit).
(SAY) "I mint test cUSDC from the faucet and deposit five hundred. The amount is encrypted client-side and stays encrypted on-chain — I get confidential prize tickets one-to-one. On Etherscan you'd see a transaction happened, but never how much."

**0:50 Decrypt balance + odds (EIP-712)** — [SHOW] "Decrypt my numbers" → sign the EIP-712 request → balance, tickets, weight, odds appear.
(SAY) "Only I can read my own numbers. I sign an EIP-712 decryption permission, the Zama relayer decrypts to my key locally — my balance, my time-weighted draw weight, my odds. Time-weighted matters: depositing right before a draw earns almost no weight, so you can't snipe draws."

**1:20 Trigger the draw** — [SHOW] the Draw engine panel. Click "Start draw now" → confirm. Then "Relay randomness seed" → confirm. Point at the 3 phases while txs run.
(SAY) "Draws are permissionless — anyone can crank them, and a keeper does it automatically. Phase one snapshots the pool and publishes exactly ONE number: the pool's total weight — like public TVL, and the only thing a draw ever reveals. Phase two: I relay its KMS decryption, the contract verifies the KMS threshold signatures on-chain, and then draws each prize tier's threshold with FHE-dot-rand — encrypted randomness, generated on-chain. No oracle to bribe."

**1:55 Selection** — [SHOW] "Advance selection" → confirm; draw completes; history row appears with winners = 🔒 encrypted.
(SAY) "Phase three walks every saver, comparing encrypted running totals against the encrypted threshold. The first past the line wins the tier — and here's the trick: every saver's winnings get updated, winners with the prize, everyone else with plus zero. The updates are indistinguishable. The winner's identity never exists in plaintext — not in state, not in events. The draw history proves a draw happened; the winner column just says: encrypted."

**2:20 Claim** — [SHOW] Winnings card → "Reveal" → decrypt → 🏆 amount + confetti → "Claim" → confirm.
(SAY) "Did I win? Only my own decryption can tell. …I did — and I claim. Claiming is winner-blind too: losers claim an encrypted zero, so even the claim transaction reveals nothing."

**2:40 Withdraw + close** — [SHOW] "Withdraw all" → confirm → decrypt wallet balance: principal + prize.
(SAY) "And my principal? Back in full, any time — no loss, guaranteed by the contract, which has no admin keys at all. Deposits encrypted, odds encrypted, winners encrypted, fairness verifiable on-chain. That's a lottery that couldn't exist without FHE. Samar Saving, live on Sepolia."
