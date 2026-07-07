import { ethers } from "hardhat";
// Seed the LIVE Sepolia PrivateOTC with a spread of demo cases so judges open a populated app,
// not an empty list. Creates Direct + RFQ intents across states: Open (public), Open (locked),
// Filled, RFQ with live bids, fresh RFQ, and a finalized Vickrey. One-shot — running twice just
// appends more intents.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x880a9c4dbB3b2749a8F11011B9ed7D8c74B0C35F";
const UNTIL = 2_000_000_000;
const EXPIRES = 2_000_000_000;
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));

let instance: any;

async function encFor(contract: string, user: string, vals: number[]) {
  const input = instance.createEncryptedInput(contract, user);
  for (const v of vals) input.add64(v);
  const enc = await input.encrypt();
  return { h: enc.handles.map(HEX), p: HEX(enc.inputProof) };
}
async function fund(from: any, to: string, eth: string) {
  await (await from.sendTransaction({ to, value: ethers.parseEther(eth) })).wait();
}
async function ensureOp(wallet: any, tokenAddr: string) {
  const t = await ethers.getContractAt("SamarCToken", tokenAddr, wallet);
  if (!(await t.isOperator(wallet.address, OTC))) await (await t.setOperator(OTC, UNTIL)).wait();
}
async function mint(wallet: any, tokenAddr: string, amt: number) {
  const t = await ethers.getContractAt("SamarCToken", tokenAddr, wallet);
  await (await t.mint(amt)).wait();
}
// maker creates an intent selling `sell` of sellTok, hidden reserve `reserve` of buyTok.
async function createIntent(maker: any, sellTok: string, buyTok: string, sell: number, reserve: number, mode: number, allowedTaker: string) {
  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  await mint(maker, sellTok, sell);
  await ensureOp(maker, sellTok);
  const e = await encFor(OTC, maker.address, [sell, reserve]);
  await (await otc.createIntent(sellTok, buyTok, e.h[0], e.h[1], e.p, mode, EXPIRES, allowedTaker)).wait();
  const id = (await otc.nextId()) - 1n;
  return id;
}
async function accept(taker: any, id: bigint, buyTok: string, offer: number) {
  await mint(taker, buyTok, offer);
  await ensureOp(taker, buyTok);
  const e = await encFor(OTC, taker.address, [offer]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, taker);
  await (await otc.acceptIntent(id, e.h[0], e.p)).wait();
}
async function bid(bidder: any, id: bigint, buyTok: string, amount: number) {
  await mint(bidder, buyTok, amount);
  await ensureOp(bidder, buyTok);
  const e = await encFor(OTC, bidder.address, [amount]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, bidder);
  await (await otc.submitBid(id, e.h[0], e.p)).wait();
}

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" });

  const B = ethers.Wallet.createRandom().connect(provider); // taker / bidder 1
  const C = ethers.Wallet.createRandom().connect(provider); // taker / bidder 2
  console.log("maker :", maker.address);
  console.log("takerB:", B.address);
  console.log("takerC:", C.address);
  console.log("funding takers…");
  await fund(maker, B.address, "0.06");
  await fund(maker, C.address, "0.05");

  const log = (t: string, id: bigint) => console.log(`  ✔ ${t} → intent #${id}`);

  // RFQ_ONLY resumes a run whose Direct cases already landed on-chain (network hiccup mid-run).
  if (!process.env.RFQ_ONLY) {
    // D1 — Direct Open, public. Hero: judge can Accept. sell 5 cETH, reserve 8000 cUSDC.
    log("D1 Direct Open (public)  cETH→cUSDC", await createIntent(maker, CETH, CUSDC, 5, 8000, 0, ethers.ZeroAddress));

    // D2 — Direct Open, reverse pair. sell 12000 cUSDC, reserve 4 cETH.
    log("D2 Direct Open (reverse) cUSDC→cETH", await createIntent(maker, CUSDC, CETH, 12000, 4, 0, ethers.ZeroAddress));

    // D3 — Direct Open, LOCKED to C (permissioned / compliance). sell 2 cETH, reserve 3000.
    log("D3 Direct Open (locked→C)cETH→cUSDC", await createIntent(maker, CETH, CUSDC, 2, 3000, 0, C.address));

    // D4 — Direct Filled. sell 3 cETH reserve 5000; B accepts offering 6000.
    {
      const id = await createIntent(maker, CETH, CUSDC, 3, 5000, 0, ethers.ZeroAddress);
      await accept(B, id, CUSDC, 6000);
      log("D4 Direct FILLED         cETH→cUSDC", id);
    }
  }

  // R1 — RFQ Open with 2 live bids (not finalized). sell 4 cETH, reserve 6000.
  {
    const id = await createIntent(maker, CETH, CUSDC, 4, 6000, 1, ethers.ZeroAddress);
    await bid(B, id, CUSDC, 9000);
    await bid(C, id, CUSDC, 7500);
    log("R1 RFQ Open (2 live bids)cETH→cUSDC", id);
  }

  // R2 — RFQ Open, fresh (0 bids). Judge can submit the first bid. sell 1 cETH, reserve 1500.
  log("R2 RFQ Open (0 bids)     cETH→cUSDC", await createIntent(maker, CETH, CUSDC, 1, 1500, 1, ethers.ZeroAddress));

  // R3 — RFQ Filled (Vickrey). sell 2 cETH reserve 5000; B bids 8000, C bids 7000; finalize → B pays 7000.
  {
    const id = await createIntent(maker, CETH, CUSDC, 2, 5000, 1, ethers.ZeroAddress);
    await bid(B, id, CUSDC, 8000);
    await bid(C, id, CUSDC, 7000);
    const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);
    await (await otcM.finalizeAuction(id, { gasLimit: 9_000_000 })).wait();
    log("R3 RFQ FILLED (Vickrey)  cETH→cUSDC", id);
  }

  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  console.log(`\n✅ seed complete — nextId now ${(await otc.nextId()).toString()} (7 new demo intents)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
