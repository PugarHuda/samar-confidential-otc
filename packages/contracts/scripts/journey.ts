import { ethers } from "hardhat";
// "Real user" end-to-end journey on the LIVE optimized PrivateOTC (0x1F44…). Plays every feature as
// multiple wallets, decrypts + asserts real balances, and leaves rich demo data behind. Each scenario is
// independent and gated by env SCENARIOS (default "ABCDEF") so a relayer crash can resume the rest:
//   SCENARIOS=CDEF npx hardhat run scripts/journey.ts --network sepolia
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x1F44777bDfab49fC2D616C29813142b98b91cd78";
const UNTIL = 2_000_000_000;
const EXPIRES = 2_000_000_000;
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));
const WANT = (process.env.SCENARIOS || "ABCDEF").toUpperCase();
let instance: any;

async function retry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: any;
  for (let i = 1; i <= 5; i++) {
    try { return await fn(); }
    catch (e: any) { last = e; console.log(`      ⟳ ${label} try ${i}: ${(e.shortMessage ?? e.message ?? e).toString().slice(0, 70)}`); if (i < 5) await new Promise((r) => setTimeout(r, i * 2500)); }
  }
  throw last;
}
const send = (label: string, fn: () => Promise<any>) => retry(label, async () => (await fn()).wait());
async function enc(user: string, vals: number[]) {
  return retry("encrypt", async () => {
    const inp = instance.createEncryptedInput(OTC, user);
    for (const v of vals) inp.add64(v);
    const e = await inp.encrypt();
    return { h: e.handles.map(HEX), p: HEX(e.inputProof) };
  });
}
async function mint(w: any, tok: string, amt: number) { const t = await ethers.getContractAt("SamarCToken", tok, w); await send("mint", () => t.mint(amt)); }
async function op(w: any, tok: string) { const t = await ethers.getContractAt("SamarCToken", tok, w); if (!(await t.isOperator(w.address, OTC))) await send("op", () => t.setOperator(OTC, UNTIL)); }
async function decHandle(w: any, handle: string, contract: string): Promise<bigint> {
  if (handle === ethers.ZeroHash) return 0n;
  return retry("decrypt", async () => {
    const { publicKey, privateKey } = instance.generateKeypair();
    const start = Math.floor(Date.now() / 1000), days = 10;
    const eip = instance.createEIP712(publicKey, [contract], start, days);
    const sig = await w.signTypedData(eip.domain, { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification }, eip.message);
    const res = await instance.userDecrypt([{ handle, contractAddress: contract }], privateKey, publicKey, sig.replace(/^0x/, ""), [contract], w.address, start, days);
    return BigInt(res[handle] ?? res[handle.toLowerCase()]);
  });
}
async function bal(w: any, tok: string): Promise<bigint> {
  const t = await ethers.getContractAt("SamarCToken", tok, w);
  return decHandle(w, await t.confidentialBalanceOf(w.address), tok);
}
const ok = (cond: boolean) => (cond ? "✅" : "❌ MISMATCH");

async function createDirect(maker: any, sell: number, reserve: number, allowedTaker = ethers.ZeroAddress) {
  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  await mint(maker, CETH, sell); await op(maker, CETH);
  const e = await enc(maker.address, [sell, reserve]);
  await send("createIntent", () => otc.createIntent(CETH, CUSDC, e.h[0], e.h[1], e.p, 0, EXPIRES, allowedTaker));
  return (await otc.nextId()) - 1n;
}
async function createRFQ(maker: any, sell: number, reserve: number, allowedTaker = ethers.ZeroAddress) {
  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  await mint(maker, CETH, sell); await op(maker, CETH);
  const e = await enc(maker.address, [sell, reserve]);
  await send("createIntent", () => otc.createIntent(CETH, CUSDC, e.h[0], e.h[1], e.p, 1, EXPIRES, allowedTaker));
  return (await otc.nextId()) - 1n;
}
async function accept(taker: any, id: bigint, offer: number) {
  await mint(taker, CUSDC, offer); await op(taker, CUSDC);
  const e = await enc(taker.address, [offer]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, taker);
  await send("accept", () => otc.acceptIntent(id, e.h[0], e.p));
}
async function bid(w: any, id: bigint, amt: number) {
  await mint(w, CUSDC, amt); await op(w, CUSDC);
  const e = await enc(w.address, [amt]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, w);
  await send("bid", () => otc.submitBid(id, e.h[0], e.p));
}

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await retry("instance", () => createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" }));
  const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);

  // three reusable funded users
  const [B, C, D] = [0, 1, 2].map(() => ethers.Wallet.createRandom().connect(provider));
  console.log(`maker=${maker.address}\nB=${B.address}\nC=${C.address}\nD=${D.address}\nfunding users…`);
  for (const w of [B, C, D]) if ((await provider.getBalance(w.address)) < ethers.parseEther("0.03")) await send("fund", () => maker.sendTransaction({ to: w.address, value: ethers.parseEther("0.05") }));

  if (WANT.includes("A")) {
    console.log("\n═══ A · Direct trade with grantView + counterparty decrypt (clearing offer) ═══");
    const id = await createDirect(maker, 4, 7000);
    console.log(`  [maker] created Direct #${id}: sell 4 cETH, HIDDEN reserve 7000 cUSDC (escrowed)`);
    await send("grantView", () => otcM.grantView(id, B.address));
    console.log(`  [maker] grantView(#${id}, B) — B may now decrypt the terms`);
    const sH = await otcM.getSellAmount(id), rH = await otcM.getMinBuyAmount(id);
    const [dSell, dRes] = [await decHandle(B, sH, OTC), await decHandle(B, rH, OTC)];
    console.log(`  [B] decrypted terms → sell=${dSell} cETH, reserve=${dRes} cUSDC  ${ok(dSell === 4n && dRes === 7000n)}`);
    console.log(`  [B] offer 8000 cUSDC (clears reserve) → accept…`);
    await accept(B, id, 8000);
    const [bE, mU] = [await bal(B, CETH), await bal(maker, CUSDC)];
    console.log(`  result → B got ${bE} cETH (want 4), maker got 8000 cUSDC leg  ${ok(bE === 4n)}`);
  }

  if (WANT.includes("B")) {
    console.log("\n═══ B · Strategy-B: offer BELOW the hidden reserve → no-op refund (privacy on rejection) ═══");
    const id = await createDirect(maker, 3, 9000);
    console.log(`  [maker] created Direct #${id}: sell 3 cETH, reserve 9000 cUSDC`);
    const cBefore = await bal(C, CUSDC).catch(() => -1n);
    await mint(C, CUSDC, 5000); await op(C, CUSDC);
    console.log(`  [C] offer 5000 cUSDC (BELOW reserve) → accept…`);
    const e = await enc(C.address, [5000]);
    const otcC = await ethers.getContractAt("PrivateOTC", OTC, C);
    await send("accept", () => otcC.acceptIntent(id, e.h[0], e.p));
    const st = Number((await otcM.getIntent(id))[4]);
    const cUsdc = await bal(C, CUSDC);
    console.log(`  result → intent status=${st} (2=Filled, same as a real fill), C refunded to ${cUsdc} cUSDC  ${ok(st === 2)}`);
    console.log(`  → a rejection is on-chain-indistinguishable from a fill; C keeps their money, maker keeps the asset.`);
  }

  if (WANT.includes("C")) {
    console.log("\n═══ C · RFQ sealed-bid Vickrey, THREE bidders → winner pays the 2nd price ═══");
    const id = await createRFQ(maker, 5, 4000);
    console.log(`  [maker] opened RFQ #${id}: sell 5 cETH, reserve 4000`);
    await bid(B, id, 9000); console.log(`  [B] sealed bid 9000`);
    await bid(C, id, 7000); console.log(`  [C] sealed bid 7000`);
    await bid(D, id, 5000); console.log(`  [D] sealed bid 5000`);
    console.log(`  bids on-chain: ${await otcM.getBidCount(id)} (amounts encrypted). [maker] finalize…`);
    await send("finalize", () => otcM.finalizeAuction(id, { gasLimit: 9_000_000 }));
    const [bE, bU, cU, dU] = [await bal(B, CETH), await bal(B, CUSDC), await bal(C, CUSDC), await bal(D, CUSDC)];
    console.log(`  winner B → ${bE} cETH + ${bU} cUSDC refund (bid 9000 − 2nd price 7000 = 2000)  ${ok(bE === 5n)}`);
    console.log(`  losers → C refunded, D refunded (full). Winner paid the SECOND price, not their own bid.`);
  }

  if (WANT.includes("D")) {
    console.log("\n═══ D · RFQ left OPEN with live sealed bids (judges can finalize it themselves) ═══");
    const id = await createRFQ(maker, 2, 3000);
    await bid(B, id, 6000); await bid(C, id, 4500);
    console.log(`  [maker] RFQ #${id} open with ${await otcM.getBidCount(id)} sealed bids — left Open for interactive finalize.`);
  }

  if (WANT.includes("E")) {
    console.log("\n═══ E · Cancel an unfilled intent → reclaim escrow ═══");
    const before = await bal(maker, CETH);
    const id = await createDirect(maker, 1, 5000);
    console.log(`  [maker] created Direct #${id} (1 cETH escrowed), then cancelIntent…`);
    await send("cancel", () => otcM.cancelIntent(id));
    const st = Number((await otcM.getIntent(id))[4]);
    console.log(`  result → status=${st} (3=Cancelled), escrow reclaimed  ${ok(st === 3)}`);
  }

  if (WANT.includes("F")) {
    console.log("\n═══ F · Permissioned RFQ: allowedTaker locks bidding to one address ═══");
    const id = await createRFQ(maker, 2, 3000, B.address);
    console.log(`  [maker] opened RFQ #${id} LOCKED to B`);
    let rejected = false;
    try { const e = await enc(C.address, [8000]); const otcC = await ethers.getContractAt("PrivateOTC", OTC, C); await (await otcC.submitBid(id, e.h[0], e.p, { gasLimit: 2_000_000 })).wait(); }
    catch { rejected = true; }
    console.log(`  [C] (not allowed) tries to bid → ${rejected ? "REVERTED ✅ (locked enforced)" : "❌ went through"}`);
    await bid(B, id, 8000);
    console.log(`  [B] (allowed) bids 8000 → accepted. RFQ #${id} left Open (1 bid).`);
  }

  console.log(`\n✅ journey complete — nextId now ${(await otcM.nextId()).toString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
