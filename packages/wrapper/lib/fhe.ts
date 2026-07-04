"use client";

// Wrapper around @zama-fhe/relayer-sdk (v0.4.x). Loaded client-side only (WASM).
// If the SDK version differs, encryptValues + userDecrypt are the only spots to re-check.
import { bytesToHex, type Hex } from "viem";

let instancePromise: Promise<any> | null = null;

async function getInstance(): Promise<any> {
  if (!instancePromise) {
    instancePromise = (async () => {
      // /web is the real ESM build for bundlers (Next/webpack). /bundle only re-exports a
      // window.relayerSDK global that a CDN <script> must populate first — wrong for us.
      const sdk: any = await import("@zama-fhe/relayer-sdk/web");
      await sdk.initSDK(); // load FHE WASM
      return sdk.createInstance({ ...sdk.SepoliaConfig, network: (window as any).ethereum });
    })();
  }
  return instancePromise;
}

const asHex = (h: unknown): Hex =>
  typeof h === "string" ? ((h.startsWith("0x") ? h : `0x${h}`) as Hex) : bytesToHex(h as Uint8Array);

/** Encrypt one or more uint64 values into a single input bundle (handles + one proof). */
export async function encryptValues(
  contract: string,
  user: string,
  values: bigint[],
): Promise<{ handles: Hex[]; proof: Hex }> {
  const inst = await getInstance();
  const input = inst.createEncryptedInput(contract, user);
  for (const v of values) input.add64(v);
  const enc = await input.encrypt();
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

  const res = await inst.userDecrypt(
    [{ handle, contractAddress }],
    privateKey,
    publicKey,
    signature.replace(/^0x/, ""),
    contracts,
    account,
    start,
    days,
  );
  return BigInt(res[handle]);
}
