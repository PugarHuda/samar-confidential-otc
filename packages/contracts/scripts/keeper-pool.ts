import { ethers } from "hardhat";
// Permissionless keeper crank for the Confidential PrizePool. Safe to run from anywhere, any
// time, by anyone (GitHub Actions cron, Chainlink Automation can cover start/pages but not the
// KMS relay): harvests due yield, then advances whatever draw phase is pending. Idempotent —
// exits cleanly when there is nothing to do.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const POOL = process.env.POOL_ADDRESS ?? "";
const YIELD = process.env.YIELD_ADDRESS ?? "";

async function main() {
  if (!POOL) throw new Error("POOL_ADDRESS not set");
  const [me] = await ethers.getSigners();
  const pool = await ethers.getContractAt("ConfidentialPrizePool", POOL, me);
  console.log("keeper:", me.address, "pool:", POOL);

  if (YIELD) {
    const ys = await ethers.getContractAt("MockYieldSource", YIELD, me);
    const due = await ys.accrued();
    if (due > 0n) {
      await (await ys.harvest()).wait();
      console.log("harvested yield:", due.toString());
    }
  }

  let state: bigint = await pool.drawState();

  if (state === 0n) {
    const [needed] = await pool.checkUpkeep("0x");
    if (!needed) {
      console.log("nothing to do — next draw at", new Date(Number(await pool.nextDrawAt()) * 1000).toISOString());
      return;
    }
    await (await pool.startDraw()).wait();
    console.log("draw started");
    state = 1n;
  }

  if (state === 1n) {
    const instance = await createInstance({
      ...SepoliaConfig,
      network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    });
    const handle = await pool.snapshotWeightHandle();
    const pub = await instance.publicDecrypt([handle]);
    await (await pool.seedDraw(pub.abiEncodedClearValues, pub.decryptionProof)).wait();
    console.log("seeded — total weight:", (await pool.lastDrawTotalWeight()).toString());
    state = await pool.drawState(); // Selecting, or Open if the draw was cancelled (W=0)
  }

  if (state === 2n) {
    const n = await pool.participantCount();
    while ((await pool.drawCursor()) < n) {
      await (await pool.drawPage(0)).wait();
      console.log("page →", (await pool.drawCursor()).toString(), "/", n.toString());
    }
    console.log("draw completed:", (await pool.drawId()).toString());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
