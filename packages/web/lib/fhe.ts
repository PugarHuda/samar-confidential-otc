"use client";

// Wrapper around @zama-fhe/relayer-sdk (v0.4.x). Loaded client-side only (WASM).
// If the SDK version differs, encryptValues + userDecrypt are the only spots to re-check.
import { bytesToHex, type Hex } from "viem";

let instancePromise: Promise<any> | null = null;

// Fallback read provider for wallets that inject no window.ethereum (WalletConnect / Coinbase).
// MetaMask-injected still takes priority so the proven path is unchanged.
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

async function getInstance(): Promise<any> {
  if (!instancePromise) {
    instancePromise = (async () => {
      // /web is the real ESM build for bundlers (Next/webpack). /bundle only re-exports a
      // window.relayerSDK global that a CDN <script> must populate first — wrong for us.
      const sdk: any = await import("@zama-fhe/relayer-sdk/web");
      await sdk.initSDK(); // load FHE WASM
      return sdk.createInstance({ ...sdk.SepoliaConfig, network: (window as any).ethereum ?? SEPOLIA_RPC });
    })().catch((e) => {
      instancePromise = null; // don't memoize a transient WASM/init failure — let the next call retry
      throw e;
    });
  }
  return instancePromise;
}

const asHex = (h: unknown): Hex =>
  typeof h === "string" ? ((h.startsWith("0x") ? h : `0x${h}`) as Hex) : bytesToHex(h as Uint8Array);

// The Zama relayer can hang; without this a stuck request leaves the UI spinning forever with no
// escape. Reject after `ms` so the caller's finally clears its busy state and shows a retry-able error.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out — relayer slow, try again`)), ms)),
  ]);
}

/** Encrypt one or more uint64 values into a single input bundle (handles + one proof). */
export async function encryptValues(
  contract: string,
  user: string,
  values: bigint[],
): Promise<{ handles: Hex[]; proof: Hex }> {
  const inst = await getInstance();
  const input = inst.createEncryptedInput(contract, user);
  for (const v of values) input.add64(v);
  const enc = await withTimeout<any>(input.encrypt(), 60_000, "encrypt");
  return { handles: enc.handles.map(asHex), proof: asHex(enc.inputProof) };
}

type SignTypedDataAsync = (args: any) => Promise<`0x${string}`>;

/** User-side decrypt of one ciphertext handle the caller is ACL-permitted to read. */
export async function userDecrypt(
  handle: string,
  contractAddress: string,
  account: string,
  signTypedDataAsync: SignTypedDataAsync,
): Promise<bigint> {
  const inst = await getInstance();
  const { publicKey, privateKey } = inst.generateKeypair();
  const start = Math.floor(Date.now() / 1000); // seconds — SDK requires a number, not a string
  const days = 10;
  const contracts = [contractAddress];

  const eip712 = inst.createEIP712(publicKey, contracts, start, days);
  const signature = await signTypedDataAsync({
    domain: eip712.domain,
    types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message,
  });

  const res = await withTimeout<any>(
    inst.userDecrypt(
      [{ handle, contractAddress }],
      privateKey,
      publicKey,
      signature.replace(/^0x/, ""),
      contracts,
      account,
      start,
      days,
    ),
    45_000,
    "decrypt",
  );
  const raw = res[handle] ?? res[handle.toLowerCase()]; // relayer may key the result by lowercased handle
  if (raw === undefined) throw new Error("relayer returned no plaintext for this handle");
  return BigInt(raw);
}
