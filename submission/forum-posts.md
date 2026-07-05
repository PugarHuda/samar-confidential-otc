# Community forum drafts — Public Project Discussions

> Post to community.zama.org. One suite post + one per app. Swap `[video]` once recorded.

---

## Suite post

**Title:** Samar — a confidential-finance stack on Zama (OTC desk + wrapper registry + airdrop)

Hey Zama community 👋

For Season 3 I shipped **three** confidential-finance apps on fhEVM that share one idea: on-chain finance where the numbers stay encrypted. They're composable — wrap a token confidentially, trade it privately, then distribute it with encrypted allocations.

- 🖥 **Hub:** https://samar-hub.vercel.app
- 💻 **Repo (monorepo):** https://github.com/PugarHuda/samar-confidential-otc

Every core FHE flow is verified live on Sepolia with reproducible scripts (settlement, Vickrey, wrap, unwrap→finalize, airdrop claim, user-decrypt). Would love feedback on the contract designs and the SDK integration — details in each app thread below.

---

## 1 · Samar OTC (Builder Track)

**Title:** Samar OTC — a confidential dark pool with hidden reserves + sealed-bid Vickrey auctions

A private OTC desk where order size, price, and the maker's **hidden reserve** stay encrypted end to end. Two modes:
- **Direct:** trustless atomic settlement via `FHE.select` — never reverts on a secret ("too low" doesn't leak); a filled trade and a no-op refund look identical on-chain.
- **RFQ:** sealed-bid **Vickrey** (second-price) auctions, all comparisons on encrypted handles.

Permissioned trades via `allowedTaker` put compliance in the contract. Live: https://samar-otc.vercel.app · Feedback welcome on the Strategy-B settlement pattern.

---

## 2 · Confidential Wrapper Registry (Bounty Track)

**Title:** The on-ramp for confidential tokens — every ERC-20↔ERC-7984 wrapper on Sepolia

Reads the official Wrappers Registry live and lists every pair. Wrap, unwrap, decrypt your balance, faucet the mocks — one dashboard. Unwrap uses `@zama-fhe/sdk` v3 `WrappedToken.unshield`, which drives the full two-phase request→public-decrypt→`finalizeUnwrap` so the ERC-20 actually returns. Live: https://samar-wrapper.vercel.app

---

## 3 · Confidential Airdrop (Special Bounty · TokenOps)

**Title:** Confidential airdrop on the TokenOps SDK — allocations nobody can snoop

Admin funds an encrypted pool and signs per-recipient allocations; recipients claim and decrypt only their own share. Built on `@tokenops/sdk/fhe-airdrop` + `@zama-fhe/sdk`. One gotcha I hit + fixed (SDK encrypt-shape mismatch) is written up here → [link to ecosystem writeup]. Live: https://samar-airdrop.vercel.app
