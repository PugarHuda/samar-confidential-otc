// Live Sepolia smoke test of the full TokenOps confidential-airdrop flow.
// admin creates+funds a campaign (SamarCToken cUSDC) -> issues an encrypted per-recipient
// claim authorization -> a funded fresh recipient claims -> assert tokens delivered.
// Run: PRIVATE_KEY=0x... node scripts/smoke.mjs
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, zeroHash, hexToBytes } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as viemSepolia } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node, sepolia } from "@zama-fhe/sdk/node";
import { ZamaSDK } from "@zama-fhe/sdk";
import {
  resolveEncryptor,
  createConfidentialAirdropFactoryClient,
  encryptUint64,
  signClaimAuthorization,
  createConfidentialAirdropClient,
} from "@tokenops/sdk/fhe-airdrop";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDC = "0x25fb7981e5D6A6400cBefA1efFcF6E80c8c6aAf7"; // our deployed SamarCToken (ERC-7984)
const tokenAbi = parseAbi([
  "function mint(uint64 amount)",
  "function setOperator(address operator, uint48 until)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
]);

const log = (...a) => console.log(...a);

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("set PRIVATE_KEY");
  const admin = privateKeyToAccount(pk);
  const recipient = privateKeyToAccount(generatePrivateKey());
  log("admin:", admin.address, "\nrecipient:", recipient.address);

  const publicClient = createPublicClient({ chain: viemSepolia, transport: http(RPC) });
  const adminWallet = createWalletClient({ account: admin, chain: viemSepolia, transport: http(RPC) });
  const recipientWallet = createWalletClient({ account: recipient, chain: viemSepolia, transport: http(RPC) });

  log("\n[1] building ZamaSDK v3 encryptor (node worker pool)…");
  const config = createConfig({ chains: [sepolia], publicClient, walletClient: adminWallet, relayers: { [sepolia.id]: node() } });
  const sdk = new ZamaSDK(config);
  // Adapter: @zama-fhe/sdk@3 returns { encryptedValues: Hex[], inputProof: Hex };
  // @tokenops/sdk@1.1.1 expects { handles: Uint8Array[], inputProof: Uint8Array }.
  const raw = sdk.relayer;
  const encryptor = {
    async encrypt(params) {
      const r = await raw.encrypt(params);
      return { handles: r.encryptedValues.map((h) => hexToBytes(h)), inputProof: hexToBytes(r.inputProof) };
    },
  };
  log("    encryptor ready:", typeof encryptor?.encrypt === "function");

  if (process.env.PROBE) {
    log("\n[PROBE] calling encryptor.encrypt(...) to inspect result shape…");
    const r = await encryptor.encrypt({ values: [{ value: 1n, type: "euint64" }], contractAddress: CUSDC, userAddress: admin.address });
    log("  result type:", typeof r, "keys:", Object.keys(r || {}));
    log("  r.handles:", r?.handles && `array(${r.handles.length})`, " r.inputProof:", r?.inputProof && `bytes(${r.inputProof.length})`);
    log("  dump:", JSON.stringify(r, (k, v) => (v instanceof Uint8Array ? `U8(${v.length})` : typeof v === "bigint" ? v.toString() : v)).slice(0, 500));
    process.exit(0);
  }

  const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient: adminWallet, encryptor });
  log("    factory:", factory.address);

  log("\n[2] admin mints 5000 cUSDC + setOperator(factory)…");
  await publicClient.waitForTransactionReceipt({ hash: await adminWallet.writeContract({ address: CUSDC, abi: tokenAbi, functionName: "mint", args: [5000n] }) });
  await publicClient.waitForTransactionReceipt({ hash: await adminWallet.writeContract({ address: CUSDC, abi: tokenAbi, functionName: "setOperator", args: [factory.address, 2000000000] }) });

  const now = Math.floor(Date.now() / 1000);
  const salt = "0x" + Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(now + i) % 16]).join("");

  log("\n[3] createAndFundConfidentialAirdrop (encrypted pool = 1000)…");
  const { airdrop } = await factory.createAndFundConfidentialAirdrop({
    params: { token: CUSDC, startTimestamp: now - 60, endTimestamp: now + 3600, canExtendClaimWindow: true, admin: admin.address },
    userSalt: salt,
    amount: 1000n,
  });
  log("    airdrop clone:", airdrop);

  log("\n[4] fund recipient with ETH, encrypt allocation (bound to recipient) + sign…");
  await publicClient.waitForTransactionReceipt({ hash: await adminWallet.sendTransaction({ to: recipient.address, value: parseEther("0.02") }) });
  const enc = await encryptUint64({ encryptor, contractAddress: airdrop, userAddress: recipient.address, value: 1000n });
  const signature = await signClaimAuthorization({ walletClient: adminWallet, airdropAddress: airdrop, recipient: recipient.address, encryptedAmountHandle: enc.handle });
  log("    signed claim authorization");

  log("\n[5] recipient claims…");
  const drop = createConfidentialAirdropClient({ publicClient, walletClient: recipientWallet, address: airdrop });
  const fee = await drop.gasFee();
  const hash = await drop.claim({ encryptedInput: enc, signature, value: fee });
  await publicClient.waitForTransactionReceipt({ hash });
  log("    claim tx:", hash);

  const bal = await publicClient.readContract({ address: CUSDC, abi: tokenAbi, functionName: "confidentialBalanceOf", args: [recipient.address] });
  const ok = bal !== zeroHash;
  log("    balance handle:", bal);

  log("\n[6] recipient user-decrypts their confidential balance…");
  const { publicKey, privateKey } = await sdk.relayer.generateTransportKeyPair();
  const start2 = Math.floor(Date.now() / 1000);
  const days2 = 10;
  const eip = await sdk.relayer.createEIP712(publicKey, [CUSDC], start2, days2);
  const types = { ...eip.types };
  delete types.EIP712Domain;
  const primaryType = eip.primaryType ?? Object.keys(types)[0];
  const sig = await recipientWallet.signTypedData({ account: recipient, domain: eip.domain, types, primaryType, message: eip.message });
  const res = await sdk.relayer.userDecrypt({
    encryptedValues: [bal],
    contractAddress: CUSDC,
    signedContractAddresses: [CUSDC],
    privateKey,
    publicKey,
    signature: sig,
    signerAddress: recipient.address,
    startTimestamp: start2,
    durationDays: days2,
  });
  const clear = res[bal]?.toString();
  log("    decrypted balance:", clear);

  const good = ok && clear === "1000";
  log("\n" + (good ? "✅ TokenOps airdrop works live — claimed AND decrypted the exact allocation (1000)" : "❌ mismatch: ok=" + ok + " clear=" + clear));
  if (!good) process.exit(1);
}

main().catch((e) => {
  console.error("\nFAILED:", e?.shortMessage ?? e?.message ?? e);
  console.error(e?.stack?.split("\n").slice(0, 4).join("\n"));
  process.exit(1);
});
