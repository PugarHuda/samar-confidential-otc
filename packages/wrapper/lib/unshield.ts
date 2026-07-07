"use client";

// All confidential ops for the wrapper via a single SDK — @zama-fhe/sdk v3.
// unshield() runs the full unwrap→finalize; decryptBalance() user-decrypts a confidential balance.
// Verified live: ../../packages/airdrop/scripts/smoke-unshield.mjs and smoke.mjs.
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia } from "@zama-fhe/sdk/chains";
import { ZamaSDK, WrappedToken } from "@zama-fhe/sdk";
import { parseAbi, zeroHash, type Hex } from "viem";

const balAbi = parseAbi(["function confidentialBalanceOf(address account) view returns (bytes32)"]);

let _sdk: any = null;
let _sdkKey: string | null = null;
function getSdk(publicClient: any, walletClient: any) {
  const key = walletClient?.account?.address ?? null;
  if (!key) throw new Error("Connect your wallet first.");
  if (!_sdk || _sdkKey !== key) {
    _sdk = new ZamaSDK(createConfig({ chains: [sepolia], publicClient, walletClient, relayers: { [sepolia.id]: web() } }));
    _sdkKey = key;
  }
  return _sdk;
}

/** Wrap `amount` (underlying base units) of a public ERC-20 into its confidential wrapper.
 *  Uses the SDK's shield — handles ERC-1363 vs approve+wrap and USDT-style allowance resets. */
export async function shield(publicClient: any, walletClient: any, cToken: `0x${string}`, amount: bigint) {
  const wt = new WrappedToken(getSdk(publicClient, walletClient), cToken);
  return wt.shield(amount);
}

/** Unwrap `amount` (confidential base units) back to the public ERC-20, fully finalized. */
export async function unshield(publicClient: any, walletClient: any, cToken: `0x${string}`, amount: bigint) {
  const wt = new WrappedToken(getSdk(publicClient, walletClient), cToken);
  return wt.unshield(amount);
}

/** User-decrypt your own confidential balance of `cToken` (only you can read it). */
export async function decryptBalance(publicClient: any, walletClient: any, cToken: `0x${string}`, account: `0x${string}`): Promise<bigint> {
  const sdk = getSdk(publicClient, walletClient);
  const handle = (await publicClient.readContract({ address: cToken, abi: balAbi, functionName: "confidentialBalanceOf", args: [account] })) as Hex;
  if (handle === zeroHash) return 0n;
  const { publicKey, privateKey } = await sdk.relayer.generateTransportKeyPair();
  const start = Math.floor(Date.now() / 1000);
  const days = 10;
  const eip = await sdk.relayer.createEIP712(publicKey, [cToken], start, days);
  const types = { ...eip.types };
  delete (types as any).EIP712Domain;
  const primaryType = eip.primaryType ?? Object.keys(types)[0];
  const signature = await walletClient.signTypedData({ account, domain: eip.domain, types, primaryType, message: eip.message });
  const res = await sdk.relayer.userDecrypt({
    encryptedValues: [handle],
    contractAddress: cToken,
    signedContractAddresses: [cToken],
    privateKey,
    publicKey,
    signature,
    signerAddress: account,
    startTimestamp: start,
    durationDays: days,
  });
  const raw = res[handle] ?? res[handle.toLowerCase()]; // relayer may key by lowercased handle
  if (raw === undefined) throw new Error("relayer returned no plaintext for this balance handle");
  return BigInt(raw);
}
