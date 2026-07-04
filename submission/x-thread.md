# X Thread — Samar

> Copy-paste ready. 8 posts. Swap `[demo link]`, `[repo link]`, `[video link]`, `@handle`. Keep the ciphertext screenshot on post 4 — it's the hook that stops the scroll.

---

**1/**
Whales don't trade on public DEXs. One big order and the bots front-run you, the market moves against you, and your competitors see your whole position.

So I built Samar — an on-chain OTC desk where the size and price stay encrypted. End to end.

Powered by @zama_fhe fhEVM 🧵

---

**2/**
The problem isn't "DeFi needs more privacy" in the abstract.

It's specific: on a public order book, size = information. Front-running, market impact, info leakage. That's why $100M trades happen OTC — through a trusted desk.

Samar removes the trust, keeps the privacy.

---

**3/**
How? Fully Homomorphic Encryption.

Your order amount is encrypted before it ever touches the chain. The contract computes on the ciphertext — checks your offer clears the reserve, moves the funds — without ever decrypting.

The math verifies the deal. Nobody reads the numbers.

---

**4/**
This is what the entire world sees when a whale swaps $100k on Samar 👇

[screenshot: Sepolia explorer, sellAmount + buyAmount as ciphertext]

Not the bots. Not your counterparty. Not even the validators. Just 🔒.

And the swap still settles atomically.

---

**5/**
The part most "confidential OTC" demos skip: settlement.

Samar's settlement is fully on-chain and trustless — no off-chain gateway you have to trust. Both legs of the swap move (or both refund) in a single tx, amounts encrypted the whole way.

---

**6/**
It even hides your reserve.

Maker sets a *hidden minimum price*. Takers bid blind. If an offer clears the reserve → atomic swap. If it's too low → a no-op refund.

Key trick: settlement NEVER reverts on a secret. "Too low" would leak. So a rejection looks identical to a fill on-chain. (We call it Strategy B.)

---

**7/**
Built with the tools you already know:
• Solidity + @zama_fhe `@fhevm/solidity` (euint64, FHE.select)
• OpenZeppelin ERC-7984 confidential tokens
• Next.js + wagmi + Relayer SDK
• Sepolia

Permissioned by design: lock a trade to a KYC'd counterparty — compliance lives in the contract. Built for RWA & institutional flow.

Contracts tested with real balance assertions — the swap provably moves funds.

---

**8/**
Try it — mint test tokens, post an encrypted intent, settle a private trade:

🔗 Demo: https://samar-otc.vercel.app
💻 Code: https://github.com/PugarHuda/samar-confidential-otc
🎥 2-min walkthrough: [video link]

Built for the @zama_fhe Developer Program. Trade big. Nobody peeks.
