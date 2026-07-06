# Reusable primitives & patterns

Building blocks from this repo that other Zama builders can lift directly. All verified live on Sepolia.

## Contracts

- **All-or-nothing confidential settlement ("Strategy B")** — `packages/contracts/contracts/PrivateOTC.sol` (`acceptIntent`). Settle a two-sided trade with encrypted amounts that never reverts on a secret condition: `FHE.select` routes funds so a filled trade and a no-op refund are indistinguishable on-chain. Escrow nets to zero on every path.
- **Sealed-bid Vickrey auction on encrypted bids** — `PrivateOTC.sol` (`finalizeAuction`). Find first/second-highest across encrypted bids and settle per-bidder via `FHE.select`: winner pays the second price **floored at the maker's encrypted reserve**, a running `awarded` flag guarantees exactly one winner on a top tie, and if no bid clears the reserve the asset returns to the maker and every bid is refunded — with **no winner or price ever revealed on-chain**.
- **Hidden reserve + counterparty-scoped decrypt** — `createIntent` + `grantView` (`FHE.allow(handle, taker)`) let one chosen counterparty decrypt terms before committing.
- **Minimal ERC-7984 demo token with open faucet** — `packages/contracts/contracts/SamarCToken.sol`.

## SDK integration

- **`@tokenops/sdk` ↔ `@zama-fhe/sdk@3` encryptor adapter** — bridges the `{handles}` vs `{encryptedValues}` shape mismatch. See `submission/ecosystem-writeup-encryptor-adapter.md` and `packages/airdrop/lib/tokenops.ts`.
- **Full unwrap via `WrappedToken.unshield`** — `packages/wrapper/lib/unshield.ts`: one call orchestrates unwrap request → public-decrypt → `finalizeUnwrap` so the ERC-20 actually returns.
- **Browser + node encrypt/decrypt** — `packages/web/lib/fhe.ts` (relayer-sdk 0.4) and `packages/airdrop/lib/tokenops.ts` (`@zama-fhe/sdk` v3 `userDecrypt`), incl. the numeric `startTimestamp/durationDays` fix.

## Verification pattern

- **Live on-chain e2e scripts** (the pattern that caught every real bug here): drive the full flow against Sepolia and assert on decrypted balances, not just mocks. See `packages/contracts/scripts/e2e-*.ts` and `packages/airdrop/scripts/smoke*.mjs`. Mocks don't enforce the HCU limit or the SDK shape — the live scripts do.

## Frontend

- **Self-contained OG social card + favicon via `next/og`** (edge runtime, no external assets) — `app/opengraph-image.tsx` / `app/icon.tsx` in each `packages/*`.
- **Design tokens** (sticker light + terminal dark) — `packages/web/tailwind.config.ts`.
