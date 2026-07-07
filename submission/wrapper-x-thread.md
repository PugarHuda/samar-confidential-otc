# X Thread — Confidential Wrapper Registry

> 6 posts. Swap `[demo]`, `[repo]`, `[video]`. Post 4 (ciphertext balance) is the hook.

---

**1/**
Confidential tokens (ERC-7984) hide your balance on-chain. Great — but how do you *get in and out*?

I built the Confidential Wrapper Registry: wrap any ERC-20 into a private ERC-7984 balance, unwrap back, and decrypt yours — every wrapper pair on Sepolia, one place.

Powered by @zama_fhe 🧵

---

**2/**
The problem: a normal ERC-20 balance is public. Anyone can see what you hold.

ERC-7984 fixes that with FHE — balances are encrypted on-chain. But to use it you need an on-ramp: a way to wrap your existing tokens in, and unwrap them out. That's the missing UX.

---

**3/**
This app reads the **official Zama Wrappers Registry** live and lists every ERC-20 ↔ ERC-7984 pair (9 today: USDC, USDT, WETH, XAUt, tGBP…).

For each: a faucet, one-click wrap, unwrap, and a decrypt button. No custom contracts — it talks straight to the deployed registry + wrappers.

---

**4/**
Here's the point. After you wrap, your confidential balance on-chain looks like this 👇

[screenshot: confidentialBalanceOf returns ciphertext]

🔒 Unreadable to everyone. Then you hit "Decrypt" — and only *you*, holding the key, see the real number. The chain never exposes it.

---

**5/**
Full loop in the demo:
mint test token → wrap into confidential → decrypt (private, local) → unwrap back to ERC-20.

Wrap is instant; unwrap requests a Gateway finalization that returns your ERC-20. All ERC-7984 + Relayer SDK.

---

**6/**
Try it — every confidential wrapper on Sepolia, in one dashboard:

🔗 Demo: https://samar-wrapper.vercel.app
💻 Code: https://github.com/PugarHuda/samar-confidential-otc
🎥 [video link]

Built for the @zama_fhe Developer Program (Bounty Track). The on-ramp for confidential tokens.
