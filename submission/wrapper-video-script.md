# ~2.5-Minute Video — Confidential Wrapper Registry

> Real-person pitch (required). Have MetaMask on Sepolia + a Sepolia explorer tab open. Format: **[SCREEN]** · **(say)**.

---

### 0:00–0:20 · Hook
**[SCREEN]** The app, list of wrapper pairs.
**(say)** "Confidential tokens on Ethereum — ERC-7984 — keep your balance encrypted on-chain. Powerful, but there's a missing piece: how do you actually get your tokens in and out? This is the Confidential Wrapper Registry. It's the on-ramp — wrap any ERC-20 into a private balance, and unwrap back, for every pair registered on Sepolia."

---

### 0:20–0:45 · The registry
**[SCREEN]** Point at the list; open the registry address on Etherscan.
**(say)** "The app reads the official Zama Wrappers Registry live — this contract on Sepolia — and lists every ERC-20 to ERC-7984 pair it knows about. USDC, USDT, WETH, tokenized gold, and more. Nothing hardcoded; if Zama registers a new pair, it shows up here."

---

### 0:45–1:15 · Faucet + wrap
**[SCREEN]** Pick USDC. Click "Faucet 1000". Enter 100, click "Wrap".
**(say)** "Let me get some test USDC from the faucet — that's a public mint on the mock token. Now I wrap 100 of it: the app approves the wrapper and calls wrap. My public USDC becomes a confidential balance in the ERC-7984 version."

---

### 1:15–1:45 · The money shot
**[SCREEN]** Explorer: call confidentialBalanceOf on the c-token → ciphertext handle. Then back in app, click "Decrypt".
**(say)** "Here's what the world sees for my confidential balance — ciphertext. Unreadable, on a public chain. Then I click Decrypt: the Relayer SDK re-encrypts it to my key locally, and only I see the real number — 100. The chain never exposed it."

---

### 1:45–2:15 · Unwrap
**[SCREEN]** Enter an amount, click "Unwrap".
**(say)** "And I can go back. Unwrap encrypts the amount and requests it; Zama's Gateway finalizes the decryption and returns my public ERC-20. A full, private round trip — in and out of confidentiality."

---

### 2:15–2:30 · Close
**[SCREEN]** Back to the pair list.
**(say)** "Every confidential wrapper on Sepolia, in one dashboard — wrap, unwrap, decrypt, faucet. The missing on-ramp for ERC-7984, built on Zama fhEVM. Thanks for watching."

---

**Tip:** pre-fund the wallet before recording. Keep the ciphertext explorer shot at full length — that's the proof.
