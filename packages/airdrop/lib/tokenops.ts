"use client";

// Browser TokenOps confidential-airdrop helpers — same flow proven live in scripts/smoke.mjs,
// with node() swapped for web(). Bridges the @zama-fhe/sdk@3 encrypt shape to @tokenops/sdk@1.
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia } from "@zama-fhe/sdk/chains";
import { ZamaSDK } from "@zama-fhe/sdk";
import { hexToBytes, parseAbi, zeroHash, type Hex } from "viem";
import {
  createConfidentialAirdropFactoryClient,
  createConfidentialAirdropClient,
  encryptUint64,
  signClaimAuthorization,
} from "@tokenops/sdk/fhe-airdrop";

// SamarCToken cUSDC (ERC-7984) — the confidential token distributed in the demo.
export const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e" as const;
export const OPERATOR_UNTIL = 2_000_000_000;

export const tokenAbi = parseAbi([
  "function mint(uint64 amount)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
]);

export type ClaimPayload = { airdrop: `0x${string}`; handle: Hex; inputProof: Hex; signature: Hex };

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
function encryptor(publicClient: any, walletClient: any) {
  const sdk = getSdk(publicClient, walletClient);
  return {
    async encrypt(params: any) {
      const r = await sdk.relayer.encrypt(params);
      return { handles: r.encryptedValues.map((h: Hex) => hexToBytes(h)), inputProof: hexToBytes(r.inputProof) };
    },
  };
}

export function factoryAddress(publicClient: any, walletClient: any): `0x${string}` {
  return createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor: encryptor(publicClient, walletClient) }).address;
}

/** Admin: deploy + fund a campaign with an encrypted pool. Caller must have setOperator(factory) on cUSDC. */
export async function createCampaign(
  publicClient: any,
  walletClient: any,
  admin: `0x${string}`,
  amount: number,
  windowSec: number,
): Promise<{ airdrop: `0x${string}` }> {
  const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor: encryptor(publicClient, walletClient) });
  const now = Math.floor(Date.now() / 1000);
  const salt = ("0x" +
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
  const { airdrop } = await factory.createAndFundConfidentialAirdrop({
    params: { token: CUSDC, startTimestamp: now - 60, endTimestamp: now + windowSec, canExtendClaimWindow: true, admin },
    userSalt: salt,
    amount: BigInt(amount),
  });
  return { airdrop };
}

/** Admin: encrypt an allocation bound to a recipient and sign it — the claim authorization. */
export async function authorize(
  publicClient: any,
  walletClient: any,
  airdrop: `0x${string}`,
  recipient: `0x${string}`,
  amount: number,
): Promise<ClaimPayload> {
  const enc = await encryptUint64({ encryptor: encryptor(publicClient, walletClient), contractAddress: airdrop, userAddress: recipient, value: BigInt(amount) });
  const signature = await signClaimAuthorization({ walletClient, airdropAddress: airdrop, recipient, encryptedAmountHandle: enc.handle });
  return { airdrop, handle: enc.handle, inputProof: enc.inputProof, signature };
}

/** Recipient: claim with the admin-issued payload. */
export async function claim(publicClient: any, walletClient: any, p: ClaimPayload): Promise<Hex> {
  const drop = createConfidentialAirdropClient({ publicClient, walletClient, address: p.airdrop });
  const fee = await drop.gasFee();
  return drop.claim({ encryptedInput: { handle: p.handle, inputProof: p.inputProof }, signature: p.signature, value: fee });
}

// Reject if the (flaky) relayer hasn't answered in time, so the UI shows a retry-able error
// instead of a spinner that never resolves.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out — relayer slow, try again`)), ms)),
  ]);
}

/** Anyone: user-decrypt your own confidential cUSDC balance (only you can read it). */
export async function decryptBalance(publicClient: any, walletClient: any, account: `0x${string}`): Promise<bigint> {
  const sdk = getSdk(publicClient, walletClient);
  const handle = (await publicClient.readContract({ address: CUSDC, abi: tokenAbi, functionName: "confidentialBalanceOf", args: [account] })) as Hex;
  if (handle === zeroHash) return 0n;
  const { publicKey, privateKey } = await sdk.relayer.generateTransportKeyPair();
  const start = Math.floor(Date.now() / 1000);
  const days = 10;
  const eip = await sdk.relayer.createEIP712(publicKey, [CUSDC], start, days);
  const types = { ...eip.types };
  delete (types as any).EIP712Domain;
  const primaryType = eip.primaryType ?? Object.keys(types)[0];
  const signature = await walletClient.signTypedData({ account, domain: eip.domain, types, primaryType, message: eip.message });
  const res = await withTimeout<any>(
    sdk.relayer.userDecrypt({
      encryptedValues: [handle],
      contractAddress: CUSDC,
      signedContractAddresses: [CUSDC],
      privateKey,
      publicKey,
      signature,
      signerAddress: account,
      startTimestamp: start,
      durationDays: days,
    }),
    45_000,
    "decrypt",
  );
  const raw = res[handle] ?? res[handle.toLowerCase()];
  if (raw === undefined) throw new Error("relayer returned no plaintext for this balance handle");
  return BigInt(raw);
}
