"use client";

// Full unwrap via @zama-fhe/sdk v3 WrappedToken.unshield — orchestrates
// unwrap request → wait → public-decrypt → finalizeUnwrap in one call, so the
// public ERC-20 actually returns. Verified live in ../../packages/airdrop/scripts/smoke-unshield.mjs.
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia } from "@zama-fhe/sdk/chains";
import { ZamaSDK, WrappedToken } from "@zama-fhe/sdk";

let _sdk: any = null;

/** Unwrap `amount` (base units) of a confidential wrapper back to the public ERC-20, fully finalized. */
export async function unshield(publicClient: any, walletClient: any, cToken: `0x${string}`, amount: bigint) {
  if (!_sdk) {
    const config = createConfig({ chains: [sepolia], publicClient, walletClient, relayers: { [sepolia.id]: web() } });
    _sdk = new ZamaSDK(config);
  }
  const wt = new WrappedToken(_sdk, cToken);
  return wt.unshield(amount);
}
