import { ethers } from "hardhat";
// Enrichment journey #2 — adds token-pair variety (reverse cUSDC→cETH), an expiring intent, and a
// whale-size order to the live PrivateOTC, exercising the same features in the other direction.
// Scenarios gated by env SCENARIOS (default "GHIJK"): SCENARIOS=IJK npx hardhat run scripts/journey2.ts --network sepolia
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x1F44777bDfab49fC2D616C29813142b98b91cd78";
const UNTIL = 2_000_000_000;
const FAR = 2_000_000_000;
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));
const WANT = (process.env.SCENARIOS || "GHIJK").toUpperCase();
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
async function decBal(w: any, tok: string): Promise<bigint> {
  const t = await ethers.getContractAt("SamarCToken", tok, w);
  const handle: string = await t.confidentialBalanceOf(w.address);
  if (handle === ethers.ZeroHash) return 0n;
  return retry("decrypt", async () => {
    const { publicKey, privateKey } = instance.generateKeypair();
    const start = Math.floor(Date.now() / 1000), days = 10;
    const eip = instance.createEIP712(publicKey, [tok], start, days);
    const sig = await w.signTypedData(eip.domain, { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification }, eip.message);
    const res = await instance.userDecrypt([{ handle, contractAddress: tok }], privateKey, publicKey, sig.replace(/^0x/, ""), [tok], w.address, start, days);
    return BigInt(res[handle] ?? res[handle.toLowerCase()]);
  });
}
const ok = (c: boolean) => (c ? "✅" : "❌");

// generic maker create (sellTok escrowed): mode 0 Direct / 1 RFQ
async function create(maker: any, sellTok: string, buyTok: string, sell: number, reserve: number, mode: number, expires = FAR, allowedTaker = ethers.ZeroAddress) {
  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  await mint(maker, sellTok, sell); await op(maker, sellTok);
  const e = await enc(maker.address, [sell, reserve]);
  await send("createIntent", () => otc.createIntent(sellTok, buyTok, e.h[0], e.h[1], e.p, mode, expires, allowedTaker));
  return (await otc.nextId()) - 1n;
}
async function accept(taker: any, id: bigint, buyTok: string, offer: number) {
  await mint(taker, buyTok, offer); await op(taker, buyTok);
  const e = await enc(taker.address, [offer]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, taker);
  await send("accept", () => otc.acceptIntent(id, e.h[0], e.p));
}
async function bid(w: any, id: bigint, buyTok: string, amt: number) {
  await mint(w, buyTok, amt); await op(w, buyTok);
  const e = await enc(w.address, [amt]);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, w);
  await send("bid", () => otc.submitBid(id, e.h[0], e.p));
}

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await retry("instance", () => createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" }));
  const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);
  const [B, C] = [0, 1].map(() => ethers.Wallet.createRandom().connect(provider));
  console.log(`maker=${maker.address}\nB=${B.address}\nC=${C.address}\nfunding…`);
  for (const w of [B, C]) if ((await provider.getBalance(w.address)) < ethers.parseEther("0.03")) await send("fund", () => maker.sendTransaction({ to: w.address, value: ethers.parseEther("0.05") }));

  if (WANT.includes("G")) {
    console.log("\n═══ G · REVERSE pair: Direct sell 15000 cUSDC for cETH (clearing) ═══");
    const id = await create(maker, CUSDC, CETH, 15000, 6, 0);
    console.log(`  [maker] Direct #${id}: sell 15000 cUSDC, hidden reserve 6 cETH`);
    console.log(`  [B] offer 8 cETH (clears) → accept…`);
    await accept(B, id, CETH, 8);
    const bU = await decBal(B, CUSDC);
    console.log(`  result → B received ${bU} cUSDC (want 15000)  ${ok(bU >= 15000n)}`);
  }

  if (WANT.includes("H")) {
    console.log("\n═══ H · REVERSE pair: RFQ sell 12000 cUSDC, 2-bidder Vickrey ═══");
    const id = await create(maker, CUSDC, CETH, 12000, 3, 1);
    console.log(`  [maker] RFQ #${id}: sell 12000 cUSDC, reserve 3 cETH`);
    await bid(B, id, CETH, 6); console.log(`  [B] bid 6 cETH`);
    await bid(C, id, CETH, 5); console.log(`  [C] bid 5 cETH`);
    await send("finalize", () => otcM.finalizeAuction(id, { gasLimit: 9_000_000 }));
    const bU = await decBal(B, CUSDC);
    console.log(`  result → winner B got ${bU} cUSDC + paid 2nd price 5 cETH  ${ok(bU >= 12000n)}`);
  }

  if (WANT.includes("I")) {
    console.log("\n═══ I · Short-expiry intent → will lapse to Expired ═══");
    const exp = Math.floor(Date.now() / 1000) + 180; // 3 min out
    const id = await create(maker, CETH, CUSDC, 2, 4000, 0, exp);
    console.log(`  [maker] Direct #${id} with expiresAt=${exp} (~3 min) — shows Open now, Expired after; then maker can cancelIntent to reclaim.`);
  }

  if (WANT.includes("J")) {
    console.log("\n═══ J · REVERSE-pair RFQ left OPEN (pair variety in open state) ═══");
    const id = await create(maker, CUSDC, CETH, 9000, 2, 1);
    await bid(B, id, CETH, 4);
    console.log(`  [maker] RFQ #${id}: sell 9000 cUSDC open with ${await otcM.getBidCount(id)} bid — left Open.`);
  }

  if (WANT.includes("K")) {
    console.log("\n═══ K · Whale-size Direct order left OPEN ═══");
    const id = await create(maker, CETH, CUSDC, 25, 40000, 0);
    console.log(`  [maker] Direct #${id}: sell 25 cETH, hidden reserve 40000 cUSDC — a large block order, Open.`);
  }

  console.log(`\n✅ enrichment complete — nextId now ${(await otcM.nextId()).toString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
