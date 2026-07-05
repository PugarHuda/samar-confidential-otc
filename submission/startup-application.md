# Zama Startup Track — application draft (Samar)

> Rolling applications. Tighten to the form's fields; this is the substance.

**Name:** Samar — confidential markets infrastructure on FHE.

**One-liner:** A confidential OTC / dark-pool layer for tokenized RWA and institutional flow, where order size, price, and reserves stay encrypted on a public chain.

**Problem.** Institutions and large holders can't trade on public DeFi: visible order size means front-running, market impact, and information leakage of their positions. Today they fall back to trusted OTC desks — reintroducing counterparty trust and opacity. As RWAs move on-chain, this privacy gap blocks serious volume.

**Solution.** Samar settles large trades on-chain with amounts encrypted end to end via Zama fhEVM. Makers post intents with a **hidden reserve**; settlement is trustless and atomic (`FHE.select`), never leaking a rejected price. Sealed-bid **Vickrey auctions** enable fair price discovery without exposing bids. `allowedTaker` puts KYC/allowlist compliance *in the contract* — matching regulated-market requirements.

**Why now / why FHE.** Confidentiality is the missing primitive for institutional on-chain markets; FHE is the only approach that computes on encrypted values without a trusted party. ERC-7984 + Zama's coprocessor make it deployable today.

**Traction (built for Season 3).** Three live, on-chain-verified apps forming one stack:
- **Samar OTC** (Direct + Vickrey) — the trading venue.
- **Wrapper Registry** — the confidential-token on-ramp.
- **Confidential Airdrop** — encrypted distribution.
Hub: https://samar-hub.vercel.app · Code: https://github.com/PugarHuda/samar-confidential-otc · every core flow proven live on Sepolia.

**Ask.** Support to harden the OTC/dark-pool contracts (audits, partial fills, on-chain compliance modules) and pilot with an RWA issuer or market maker.

**Roadmap.** Partial fills & RFQ depth → compliance/allowlist modules (KYC attestations) → RWA pair onboarding → mainnet pilot.
