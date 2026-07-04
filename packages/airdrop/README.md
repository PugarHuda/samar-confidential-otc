# Confidential Airdrop (TokenOps × Zama)

Confidential token distribution on the **TokenOps SDK** — totals and per-recipient allocations stay FHE-encrypted on-chain, while each recipient verifies and claims exactly their share.

For the **Zama Developer Program — Special Bounty (TokenOps)**.

## Status

Feasibility confirmed and full API extracted; deps installed. The two-role admin/recipient UI is the remaining build. See **`../../submission/tokenops-plan.md`** for the exact SDK flow (`createAndFundConfidentialAirdrop` → `encryptUint64` + `signClaimAuthorization` → `claim`), Sepolia factory resolution, and the recommended node smoke-test to verify the flow live before shipping the frontend.

## Stack

`@tokenops/sdk@1.1.1` (`/fhe-airdrop`) · `@zama-fhe/sdk@3` + `@zama-fhe/react-sdk@3` · Next.js · wagmi/viem/RainbowKit · Sepolia.

## Run

```bash
npm install
npm run dev
```
