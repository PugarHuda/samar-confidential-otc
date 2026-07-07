import { ethers } from "hardhat";
// Seed ONE finalized Vickrey (RFQ Filled), resumable across the relayer's uncaught-crash flakiness.
// Uses two FIXED throwaway bidder wallets so reruns reuse their balance + approvals (no ETH bleed).
// Each run: target the highest-id maker Open RFQ, top it up to 2 bids (skipping bidders who already
// bid), then finalize. Finalize needs no relayer, so once bids land it always completes.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x7bde6aC99D3Df939941232159b2E675ACBD5A932";
const UNTIL = 2_000_000_000;
const EXPIRES = 2_000_000_000;
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));
// Optional FIXED bidder keys (testnet only) so reruns reuse the same wallets and can resume a crashed
// run. Set SEED_KEY_1 / SEED_KEY_2 in the environment. Never hardcode keys in the repo — if unset we
// fall back to fresh random wallets (resume-across-runs then no longer works, which is fine post-seed).

let instance: any;

async function retry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: any;
  for (let i = 1; i <= 5; i++) {
    try { return await fn(); }
    catch (e: any) { last = e; console.log(`    ⟳ ${label} try ${i}: ${e.shortMessage ?? e.message ?? e}`); if (i < 5) await new Promise((r) => setTimeout(r, i * 3000)); }
  }
  throw last;
}
async function encFor(user: string, vals: number[]) {
  return retry("encrypt", async () => {
    const input = instance.createEncryptedInput(OTC, user);
    for (const v of vals) input.add64(v);
    const enc = await input.encrypt();
    return { h: enc.handles.map(HEX), p: HEX(enc.inputProof) };
  });
}
const send = (label: string, txFn: () => Promise<any>) => retry(label, async () => (await txFn()).wait());
async function ensureOp(w: any, tok: string) {
  const t = await ethers.getContractAt("SamarCToken", tok, w);
  if (!(await t.isOperator(w.address, OTC))) await send("op", () => t.setOperator(OTC, UNTIL));
}
async function mint(w: any, tok: string, amt: number) {
  const t = await ethers.getContractAt("SamarCToken", tok, w);
  await send("mint", () => t.mint(amt));
}
async function bid(w: any, id: bigint, amt: number) {
  await mint(w, CUSDC, amt); await ensureOp(w, CUSDC);
  const e = await encFor(w.address, [amt]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, w);
  await send("bid", () => otc.submitBid(id, e.h[0], e.p));
}

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await retry("instance", () => createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" }));
  const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);
  const B = process.env.SEED_KEY_1 ? new ethers.Wallet(process.env.SEED_KEY_1, provider) : ethers.Wallet.createRandom().connect(provider);
  const C = process.env.SEED_KEY_2 ? new ethers.Wallet(process.env.SEED_KEY_2, provider) : ethers.Wallet.createRandom().connect(provider);

  // top up bidder gas only when low
  for (const w of [B, C]) {
    if ((await provider.getBalance(w.address)) < ethers.parseEther("0.02"))
      await send("fund", () => maker.sendTransaction({ to: w.address, value: ethers.parseEther("0.04") }));
  }

  // target: an Open RFQ that OUR fixed bidders already bid on (a crashed prior run to resume).
  // We deliberately do NOT adopt someone else's open auction (e.g. a seed.ts open-with-live-bids
  // intent we want to leave interactive) — if none of ours is found, create a fresh one.
  const nextId = await otcM.nextId();
  let target: bigint | null = null;
  for (let id = nextId - 1n; id >= 0n && id > nextId - 12n; id--) {
    const it = await otcM.getIntent(id);
    const mineOpenRFQ = it[0].toLowerCase() === maker.address.toLowerCase() && Number(it[3]) === 1 && Number(it[4]) === 0;
    if (mineOpenRFQ && ((await otcM.hasBid(id, B.address)) || (await otcM.hasBid(id, C.address)))) { target = id; break; }
  }
  if (target === null) {
    await mint(maker, CETH, 2); await ensureOp(maker, CETH);
    const e = await encFor(maker.address, [2, 5000]);
    await send("createIntent", () => otcM.createIntent(CETH, CUSDC, e.h[0], e.h[1], e.p, 1, EXPIRES, ethers.ZeroAddress));
    target = (await otcM.nextId()) - 1n;
  }
  console.log(`target RFQ #${target}, current bids: ${await otcM.getBidCount(target)}`);

  // top up to 2 bids, skipping any bidder who already bid (idempotent across reruns)
  if (!(await otcM.hasBid(target, B.address))) { await bid(B, target, 8000); console.log("  ✔ B bid 8000"); }
  if (!(await otcM.hasBid(target, C.address))) { await bid(C, target, 7000); console.log("  ✔ C bid 7000"); }

  await send("finalize", () => otcM.finalizeAuction(target!, { gasLimit: 9_000_000 }));
  const it = await otcM.getIntent(target!);
  console.log(`  ✔ R3 RFQ #${target} status now ${Number(it[4])} (2 = Filled)`);
  console.log(`\n✅ Vickrey seed complete — nextId ${(await otcM.nextId()).toString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
