# ~2.5-Minute Video — Confidential Airdrop (TokenOps × Zama)

> Real-person pitch (required). Two wallets on Sepolia: Admin + Recipient. Format: **[SCREEN]** · **(say)**.

### 0:00–0:20 · Hook
**[SCREEN]** App header.
**(say)** "Every airdrop today publishes who got how much — the whole allocation list is public. That invites sybil farming, front-running, and targeting. This is a confidential airdrop: the pool and every recipient's allocation stay encrypted on-chain. Built on the TokenOps SDK and Zama fhEVM."

### 0:20–0:50 · Admin creates a campaign
**[SCREEN]** Admin wallet. Click "Mint cUSDC + authorize", then set pool 1000 + "Create + fund".
**(say)** "As the admin, I mint a demo confidential token and authorize the TokenOps factory. Then I create a campaign funded with an encrypted pool of 1000 — the total is encrypted the moment it hits the chain. The SDK deploys a campaign contract and funds it in one step."

### 0:50–1:25 · Issue an encrypted allocation
**[SCREEN]** Enter recipient address + amount 100 → "Encrypt + sign". Show the payload textarea.
**(say)** "Now I allocate 100 to a recipient. The amount is encrypted — bound to that specific address — and I sign it with EIP-712. Out comes a claim authorization. I hand this payload to the recipient; nothing about the amount is revealed to anyone else."

### 1:25–1:55 · Recipient claims
**[SCREEN]** Switch to Recipient wallet. Paste payload into the claim box → "Claim".
**(say)** "As the recipient, in a second wallet, I paste the authorization and claim. I receive the confidential tokens — and the transaction going through proves the whole encrypted distribution works end to end on Sepolia."

### 1:55–2:20 · Money shot
**[SCREEN]** Explorer: the allocation handle / confidential balance = ciphertext.
**(say)** "Here's the point. On the public chain, my allocation is ciphertext — unreadable to other recipients, to bots, to validators. Only I, with my key, can decrypt what I received. That's confidential token distribution."

### 2:20–2:35 · Close
**(say)** "Built on the TokenOps SDK and Zama fhEVM, verified live on Sepolia. Airdrops nobody can snoop. Thanks for watching."

**Tip:** pre-mint/authorize on the admin wallet and pre-fund the recipient with a little ETH before recording. Keep the ciphertext explorer shot at full length.
