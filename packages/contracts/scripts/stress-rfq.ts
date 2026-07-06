import { ethers } from "hardhat";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

// Stress the RFQ finalizeAuction at N bidders to find the live HCU ceiling on Sepolia.
// Usage: BIDDERS=10 npx hardhat run scripts/stress-rfq.ts --network sepolia
const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x880a9c4dbB3b2749a8F11011B9ed7D8c74B0C35F";
const UNTIL = 2_000_000_000;
const EXPIRES = 2_000_000_000;
const N = Number(process.env.BIDDERS || "10");
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));

let instance: any;

// public RPC returns empty responses under load — retry transient failures with backoff.
async function retry<T>(fn: () => Promise<T>, label: string, n = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e.shortMessage ?? e.message ?? String(e);
      if (i >= n) throw e;
      console.log(`  · retry ${label} (${i + 1}/${n}): ${msg.slice(0, 60)}`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}
const sendTx = (fn: () => Promise<any>, label: string) => retry(async () => (await fn()).wait(), label);

async function encFor(contract: string, user: string, vals: number[]) {
  const input = instance.createEncryptedInput(contract, user);
  for (const v of vals) input.add64(v);
  const enc = await input.encrypt();
  return { h: enc.handles.map(HEX), p: HEX(enc.inputProof) };
}

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" });
  console.log(`Stress test: ${N} bidders. maker=${maker.address}`);

  // fresh bidder wallets
  const bidders = Array.from({ length: N }, () => ethers.Wallet.createRandom().connect(provider));
  console.log("funding bidder wallets…");
  for (let i = 0; i < N; i++) await sendTx(() => maker.sendTransaction({ to: bidders[i].address, value: ethers.parseEther("0.02") }), `fund ${i}`);

  // maker opens an RFQ selling N cETH, reserve 0 (HCU cost is value-independent — every FHE op still runs)
  const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);
  const tEth = await ethers.getContractAt("SamarCToken", CETH, maker);
  await sendTx(() => tEth.mint(N), "maker mint");
  if (!(await retry(() => tEth.isOperator(maker.address, OTC), "isOp"))) await sendTx(() => tEth.setOperator(OTC, UNTIL), "maker setOp");
  const em = await retry(() => encFor(OTC, maker.address, [N, 0]), "maker enc");
  await sendTx(() => otcM.createIntent(CETH, CUSDC, em.h[0], em.h[1], em.p, 1, EXPIRES, ethers.ZeroAddress), "createIntent");
  const rId = (await retry(() => otcM.nextId(), "nextId")) - 1n;
  console.log(`RFQ intent ${rId} open. Bidders mint+op+bid (distinct bids)…`);

  // each bidder mints distinct cUSDC, authorizes, submits bid. Batched to limit concurrent RPC load.
  const oneBidder = async (w: any, i: number) => {
    const bid = 1000 + i * 100; // distinct → no ties, worst-case unique-winner path still exercised
    const usdc = await ethers.getContractAt("SamarCToken", CUSDC, w);
    await sendTx(() => usdc.mint(bid), `b${i} mint`);
    await sendTx(() => usdc.setOperator(OTC, UNTIL), `b${i} setOp`);
    const e = await retry(() => encFor(OTC, w.address, [bid]), `b${i} enc`);
    const otcW = await ethers.getContractAt("PrivateOTC", OTC, w);
    await sendTx(() => otcW.submitBid(rId, e.h[0], e.p), `b${i} bid`);
    console.log(`  bidder ${i} bid ${bid} ✓`);
  };
  for (let i = 0; i < N; i += 3) await Promise.all(bidders.slice(i, i + 3).map((w, j) => oneBidder(w, i + j)));
  console.log(`bids in: ${await retry(() => otcM.getBidCount(rId), "bidCount")}. finalizing…`);

  const isTransient = (m: string) => /invalid json-rpc|empty|timeout|network|econn|fetch|503|429/i.test(m);
  for (let attempt = 0; ; attempt++) {
    try {
      const rc = await (await otcM.finalizeAuction(rId, { gasLimit: 16_700_000n })).wait();
      console.log(`\n${rc?.status === 1 ? "✅" : "❌ reverted"} finalizeAuction(${N} bidders) — gasUsed=${rc?.gasUsed?.toString()} status=${rc?.status} (cap 16777216)`);
      break;
    } catch (e: any) {
      const msg = e.shortMessage ?? e.message ?? String(e);
      if (isTransient(msg) && attempt < 4) {
        console.log(`  · transient on finalize (${attempt + 1}/4): ${msg.slice(0, 60)} — retrying`);
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      console.log(`\n❌ finalizeAuction(${N} bidders) FAILED (revert / limit) — ${msg}`);
      console.log("   → this bidder count exceeds the live limit; cap MAX_BIDDERS below it.");
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
