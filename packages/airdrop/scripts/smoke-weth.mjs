// Disambiguate WrappedToken.unshield units on an 18/6-decimal pair (WETH underlying 18, cWETH 6).
// If unshield takes CONFIDENTIAL units (6), unshield(1e6) returns ~1 WETH (1e18). Proves the app fix.
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as viemSepolia } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node, sepolia } from "@zama-fhe/sdk/node";
import { ZamaSDK, WrappedToken } from "@zama-fhe/sdk";

const WETH = "0xff54739b16576FA5402F211D0b938469Ab9A5f3F"; // 18 dec
const CWETH = "0x46208622DA27d91db4f0393733C8BA082ed83158"; // 6 dec
const erc20 = parseAbi(["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)"]);

async function main() {
  const admin = privateKeyToAccount(process.env.PRIVATE_KEY);
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const publicClient = createPublicClient({ chain: viemSepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account: admin, chain: viemSepolia, transport: http(rpc) });
  const sdk = new ZamaSDK(createConfig({ chains: [sepolia], publicClient, walletClient, relayers: { [sepolia.id]: node() } }));
  const wt = new WrappedToken(sdk, CWETH);

  console.log("mint 3 WETH + shield 2 WETH (2e18)…");
  await publicClient.waitForTransactionReceipt({ hash: await walletClient.writeContract({ address: WETH, abi: erc20, functionName: "mint", args: [admin.address, 3n * 10n ** 18n] }) });
  await wt.shield(2n * 10n ** 18n);

  const pre = await publicClient.readContract({ address: WETH, abi: erc20, functionName: "balanceOf", args: [admin.address] });
  console.log("WETH before unshield:", (pre / 10n ** 18n).toString());

  console.log("unshield 1e6 (1 WETH in CONFIDENTIAL 6-dec units)…");
  await wt.unshield(1n * 10n ** 6n);

  const post = await publicClient.readContract({ address: WETH, abi: erc20, functionName: "balanceOf", args: [admin.address] });
  const backWei = post - pre;
  console.log("WETH after:", (post / 10n ** 18n).toString(), " delta(wei):", backWei.toString());
  const ok = backWei === 10n ** 18n;
  console.log("\n" + (ok ? "✅ unshield takes CONFIDENTIAL units — app fix (cDec) is correct" : `⚠ delta=${backWei} (expected 1e18) — unshield units differ; revisit the fix`));
  if (!ok) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e?.shortMessage ?? e?.message ?? e); process.exit(1); });
