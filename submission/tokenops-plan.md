# TokenOps Special Bounty ($2.5k) — turnkey build plan

Confidential **airdrop** app on the TokenOps SDK. Research verdict: TokenOps is push-distribution only (no auctions), so this is the natural fit — **not** the Samar Vickrey auction.

Status: feasibility confirmed, full API extracted, deps installed in `packages/airdrop`. The working admin+recipient UI is the remaining build (a focused effort on the unfamiliar `@zama-fhe/sdk@3` encryptor).

## Stack (installed)
- `@tokenops/sdk@1.1.1` — `/fhe-airdrop` + `/fhe-airdrop/react`
- `@zama-fhe/sdk@3.2.0` (encryptor: `RelayerNode` from `/node`, or React `useZamaSDK().relayer`) + `@zama-fhe/react-sdk@3`
- viem `^2.47`, wagmi v2, RainbowKit — reused from the Samar stack
- Factory address is resolved by the SDK per chain (`getFheAirdropFactoryAddress(11155111)`); no hardcoding.

## Exact flow (from the SDK type defs)

**Admin — create + fund a campaign**
```ts
import { createConfidentialAirdropFactoryClient } from "@tokenops/sdk/fhe-airdrop";
// token = any ERC-7984 confidential token the admin holds (e.g. our SamarCToken cUSDC)
await token.setOperator(factoryAddress, deadline);            // let the factory pull funds
const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor });
const { airdrop } = await factory.createAndFundConfidentialAirdrop({
  params: { token, startTimestamp, endTimestamp, canExtendClaimWindow: true, admin },
  userSalt,           // any unique bytes32
  amount: 1_000_000n, // SDK encrypts the pool amount (ERC-7984 = 6 decimals)
});
```

**Admin — issue a per-recipient claim authorization** (off-chain; distribute the pair to each recipient)
```ts
import { encryptUint64, signClaimAuthorization } from "@tokenops/sdk/fhe-airdrop";
const enc = await encryptUint64({ encryptor, contractAddress: airdrop, userAddress: recipient, value: alloc });
const signature = await signClaimAuthorization({ walletClient /* admin */, airdropAddress: airdrop, recipient, encryptedAmountHandle: enc.handle });
// give the recipient { encryptedInput: enc, signature }
```

**Recipient — claim + decrypt**
```ts
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
const drop = createConfidentialAirdropClient({ publicClient, walletClient /* recipient */, address: airdrop });
const fee = await drop.gasFee();
await drop.claim({ encryptedInput, signature, value: fee });  // receives confidential tokens
// then decrypt the new ERC-7984 balance via the Zama relayer userDecrypt (as in Samar/Wrapper)
```

## UI shape (two roles, one page)
- **Admin panel:** pick an ERC-7984 token → set window → create+fund → paste recipient addresses + amounts → generate claim links (`{airdrop, encryptedInput, signature}` encoded in a URL).
- **Recipient panel:** open a claim link → connect → `claim()` → decrypt & show the amount received.

## De-risk before UI (recommended)
Write a node smoke-test (mirroring `packages/contracts/scripts/e2e-settle.ts`): admin creates+funds an airdrop with our deployed `SamarCToken`, issues an auth for a generated recipient wallet, recipient claims, decrypt asserts the amount. Uses `RelayerNode` from `@zama-fhe/sdk/node` as the encryptor. Proves the whole flow live on Sepolia before building the frontend.

## Key gotchas (from the type docs)
- `encryptUint64.userAddress` MUST be the **recipient** — `FHE.fromExternal` rejects proofs bound to anyone else.
- The signature commits to the exact handle; do **not** re-encrypt on the recipient side.
- An unfunded clone passes preflight but reverts on claim (`FheHandleNotAllowedError`) — fund before issuing claims.
- Node ≥ 22 (inherited from `@zama-fhe/sdk`).
