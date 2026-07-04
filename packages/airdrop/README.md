# Confidential Airdrop (TokenOps × Zama)

Confidential token distribution on the **TokenOps SDK** — totals and per-recipient allocations stay FHE-encrypted on-chain, while each recipient verifies and claims exactly their share.

For the **Zama Developer Program — Special Bounty (TokenOps)**.

## Status: working, verified live

The full flow — admin `createAndFundConfidentialAirdrop` → `encryptUint64` + `signClaimAuthorization` → recipient `claim` — is **proven live on Sepolia** by `scripts/smoke.mjs` (real claim tx). The admin + recipient UI is live at https://samar-airdrop.vercel.app.

Key detail: `@tokenops/sdk@1.1.1` expects the encryptor to return `{ handles: Uint8Array[], inputProof }`, but `@zama-fhe/sdk@3.2` returns `{ encryptedValues: Hex[], inputProof: Hex }`. A thin adapter in `lib/tokenops.ts` bridges the two. See `../../submission/tokenops-plan.md` for the full recipe.

```bash
PRIVATE_KEY=0x... node scripts/smoke.mjs   # end-to-end proof on Sepolia
```

## Stack

`@tokenops/sdk@1.1.1` (`/fhe-airdrop`) · `@zama-fhe/sdk@3` + `@zama-fhe/react-sdk@3` · Next.js · wagmi/viem/RainbowKit · Sepolia.

## Run

```bash
npm install
npm run dev
```
