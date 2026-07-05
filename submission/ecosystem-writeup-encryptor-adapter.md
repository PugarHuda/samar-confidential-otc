# Gotcha: bridging `@tokenops/sdk` and `@zama-fhe/sdk` v3 encryptors

> A short, reusable writeup for the Zama ecosystem (gist / forum / blog). If you're building a confidential airdrop/disperse app on the TokenOps SDK with the current `@zama-fhe/sdk@3`, you'll hit this. Here's the 5-minute fix.

## Symptom

Wiring `@tokenops/sdk/fhe-airdrop` with `@zama-fhe/sdk@3`'s relayer as the encryptor, `createAndFundConfidentialAirdrop` / `encryptUint64` throws:

```
TypeError: Cannot read properties of undefined (reading 'length')
  at encryptUint64 (@tokenops/sdk/.../chunk-...js)
```

## Cause

`@tokenops/sdk@1.1.1` expects the encryptor to return **`{ handles: Uint8Array[], inputProof: Uint8Array }`** (it calls `handles.length` then `bytesToHex(handles[0])`).

But `@zama-fhe/sdk@3.2`'s relayer `.encrypt(...)` returns **`{ encryptedValues: Hex[], inputProof: Hex }`** — the key was renamed (`handles` → `encryptedValues`) and the values are hex strings, not `Uint8Array`.

The docs example `resolveEncryptor(() => sdk.relayer)` assumes the older shape, so it silently mismatches.

## Fix — a thin adapter

```ts
import { hexToBytes } from "viem";

const encryptor = {
  async encrypt(params) {
    const r = await sdk.relayer.encrypt(params);           // v3 shape
    return {
      handles: r.encryptedValues.map((h) => hexToBytes(h)), // -> what TokenOps expects
      inputProof: hexToBytes(r.inputProof),
    };
  },
};
```

Pass this `encryptor` to the TokenOps factory/airdrop clients. Done.

## Two more small gotchas while you're here

1. **`userDecrypt` / `createEIP712` want numbers, not strings.** `startTimestamp` and `durationDays` must be `number` (e.g. `10`), not `"10"` — a string throws `InvalidTypeError ... UintNumber`.
2. **Node ≥ 22** is required (inherited from `@zama-fhe/sdk`); an unfunded airdrop clone passes preflight but reverts on `claim` with `FheHandleNotAllowedError` — fund before issuing claims.

All verified live on Sepolia — working reference: https://github.com/PugarHuda/samar-confidential-otc (`packages/airdrop/scripts/smoke.mjs`).
