// Live Sepolia proof that unwrap FULLY completes via @zama-fhe/sdk v3 WrappedToken.unshield()
// (orchestrates unwrap request -> wait -> public-decrypt -> finalizeUnwrap in one call).
// Run: PRIVATE_KEY=0x... node scripts/smoke-unshield.mjs
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as viemSepolia } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node, sepolia } from "@zama-fhe/sdk/node";
import { ZamaSDK, WrappedToken } from "@zama-fhe/sdk";

const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const CUSDC = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const erc20 = parseAbi(["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"]);

async function main() {
  const admin = privateKeyToAccount(process.env.PRIVATE_KEY);
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const publicClient = createPublicClient({ chain: viemSepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account: admin, chain: viemSepolia, transport: http(rpc) });

  const config = createConfig({ chains: [sepolia], publicClient, walletClient, relayers: { [sepolia.id]: node() } });
  const sdk = new ZamaSDK(config);
  const wt = new WrappedToken(sdk, CUSDC);

  const dec = await publicClient.readContract({ address: USDC, abi: erc20, functionName: "decimals" });
  const one = 10n ** BigInt(dec);

  console.log("mint 2000 USDC Mock…");
  await publicClient.waitForTransactionReceipt({ hash: await walletClient.writeContract({ address: USDC, abi: erc20, functionName: "mint", args: [admin.address, 2000n * one] }) });

  console.log("shield 1000 (wrap)…");
  await wt.shield(1000n * one);

  const pre = await publicClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [admin.address] });
  console.log("underlying USDC before unshield:", (pre / one).toString());

  console.log("unshield 500 (unwrap + finalize in one call)…");
  await wt.unshield(500n * one);

  const post = await publicClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [admin.address] });
  console.log("underlying USDC after unshield:", (post / one).toString());

  const ok = post > pre;
  console.log("\n" + (ok ? `✅ Unwrap FULLY completes via WrappedToken.unshield — got ${((post - pre) / one).toString()} USDC back` : "❌ underlying did not increase"));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error("FAILED:", e?.shortMessage ?? e?.message ?? e);
  console.error(String(e?.stack ?? "").split("\n").slice(0, 5).join("\n"));
  process.exit(1);
});
