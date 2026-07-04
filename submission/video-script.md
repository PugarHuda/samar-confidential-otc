# 3-Minute Pitch Video — Samar

> Real-person pitch (required — AI voice/video is disqualified). Two windows ready before recording: Wallet A (maker) and Wallet B (taker), both funded via the Faucet. Have a Sepolia explorer tab open on the OTC contract.
> Format per scene: **[SCREEN]** what to show · **(say)** narration. Target ~2:50.

---

### 0:00–0:20 · Hook
**[SCREEN]** Landing page hero ("Trade big. Nobody peeks.")
**(say)** "If you want to move a large amount on-chain, you have a problem. The moment your order is visible, bots front-run it, the market moves against you, and everyone sees your position. That's why big trades happen off-exchange — through a trusted middleman. This is Samar. It gives you that privacy, on-chain, with no middleman to trust."

---

### 0:20–0:45 · The idea
**[SCREEN]** "How it works" section (the 4 steps)
**(say)** "Samar is a confidential OTC desk built on Zama's fhEVM. The trick is Fully Homomorphic Encryption: your order size and price are encrypted before they ever hit the chain, and the smart contract computes directly on that encrypted data — it settles the trade without ever decrypting the numbers."

---

### 0:45–1:15 · Create an intent (Wallet A / maker)
**[SCREEN]** App → Create → Direct. Fill: sell 5 cETH, hidden reserve 9000 cUSDC. Click "Encrypt & broadcast". Show the encrypting overlay, then the tx confirm.
**(say)** "I'm the maker. I want to sell 5 cETH, and I'll set a hidden reserve — my secret minimum price. I never reveal it. When I submit, the amounts are encrypted client-side into a ciphertext and a proof, then broadcast. My cETH is now escrowed by the contract."

---

### 1:15–1:45 · The money shot
**[SCREEN]** Switch to the Sepolia explorer tab. Open the createIntent transaction / the intent's storage. Point at the amount fields showing ciphertext.
**(say)** "Here's the whole point. This is the transaction on a public block explorer. The sell amount, the reserve — this is what the entire world sees. It's ciphertext. Unreadable. Not to a bot, not to a competitor, not even to the validators who produced the block. And yet the order is live and fully functional."

---

### 1:45–2:20 · Accept & settle (Wallet B / taker)
**[SCREEN]** Wallet B → Active Intents (amounts show as 🔒). Open the intent → "Accept" → enter offer 10000 cUSDC → "Encrypt offer & settle". Show the "Atomic settlement · FHE.select" overlay, then confirmed.
**(say)** "Now I'm the taker, in a second wallet. I see the asset pair but not the size. I make an encrypted offer of 10,000 cUSDC. The contract checks — on encrypted data — whether my offer clears the maker's hidden reserve, and settles both legs atomically. If my offer were too low, it would simply refund both sides — and crucially, a rejection is indistinguishable from a fill on-chain, so 'too low' never leaks."

---

### 2:20–2:45 · Proof it moved
**[SCREEN]** Portfolio on each wallet → Decrypt. Maker now holds cUSDC, taker now holds cETH.
**(say)** "And it's real. I decrypt my balance locally — only I hold the key — and the funds actually moved. The maker got paid, I got the asset. A complete private trade, settled trustlessly on a public chain."

---

### 2:45–3:00 · Close
**[SCREEN]** Back to landing / logo.
**(say)** "Samar. Solidity, ERC-7984, and Zama fhEVM. Confidential OTC, no trusted desk. Trade big — nobody peeks. Thanks for watching."

---

**Recording tips**
- Pre-mint and pre-authorize both wallets before recording so you're not waiting on faucet txs on camera.
- Sepolia confirmations take a few seconds — cut/speed-up dead air between the tx submit and confirm, but keep the ciphertext explorer shot at full length; that's the proof.
- Say a real sentence over the explorer shot — that 30 seconds is what wins it.
