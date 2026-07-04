# X Thread — Confidential Airdrop (TokenOps × Zama)

> 6 posts. Swap `[demo]`, `[repo]`, `[video]`. Post 4 is the hook.

**1/**
Every airdrop today leaks who got how much. Allocations are public — inviting sybil farming, MEV, and "why did they get 10× me" drama.

I built a confidential airdrop: the pool and every recipient's allocation stay encrypted. Only you can read your share.

TokenOps SDK + @zama_fhe 🧵

**2/**
Public distribution is a privacy hole. The moment allocations hit the chain, everyone sees the cap table: who's an insider, who dumped, who to target.

Serious token distribution — investor unlocks, team payouts, targeted rewards — needs confidentiality. That's what FHE unlocks.

**3/**
How it works, three steps, zero plaintext:
① Admin funds a campaign with an FHE-**encrypted** pool.
② For each recipient, the admin encrypts an allocation bound to that address and signs it (EIP-712).
③ The recipient claims — receives an ERC-7984 confidential balance and decrypts only their own.

**4/**
On-chain, an allocation looks like this 👇
[screenshot: encrypted handle]
🔒 Ciphertext. No observer — not other recipients, not bots, not validators — can read who got what. The recipient claims, and only they decrypt the number.

**5/**
Built on the **TokenOps SDK** (`@tokenops/sdk/fhe-airdrop`) + `@zama-fhe/sdk` + ERC-7984, on Sepolia. The full create→fund→sign→claim flow is **verified live** on-chain (real claim tx in the repo).

**6/**
Confidential token distribution, done right:
🔗 [demo]
💻 [repo]
🎥 [video]

Built for the @zama_fhe Developer Program (Special Bounty · TokenOps). Airdrops nobody can snoop.
