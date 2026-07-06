import { ethers } from "hardhat";
// Live Sepolia multi-party settlement: a full Direct trade AND a 2-bidder RFQ Vickrey auction,
// funding fresh taker wallets from the deployer. Proves the heavy FHE.select settlement paths
// (accept + finalizeAuction) actually execute on the real coprocessor, and that Vickrey charges
// the second price. This is the end-to-end confidential-trade proof.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x7d5CDDE8495f60787974eED3ED44FD4E36449809";
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

async function decBal(wallet: any, tokenAddr: string): Promise<bigint> {
  const token = await ethers.getContractAt("SamarCToken", tokenAddr, wallet);
  const handle: string = await token.confidentialBalanceOf(wallet.address);
  if (handle === ethers.ZeroHash) return 0n;
  const { publicKey, privateKey } = instance.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const days = 10;
  const eip = instance.createEIP712(publicKey, [tokenAddr], start, days);
  const sig = await wallet.signTypedData(
    eip.domain,
    { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification },
    eip.message,
  );
  const res = await instance.userDecrypt(
    [{ handle, contractAddress: tokenAddr }],
    privateKey,
    publicKey,
    sig.replace(/^0x/, ""),
    [tokenAddr],
    wallet.address,
    start,
    days,
  );
  return BigInt(res[handle]);
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

async function main() {
  const [maker] = await ethers.getSigners();
  const provider = ethers.provider;
  instance = await createInstance({ ...SepoliaConfig, network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com" });

  const B = ethers.Wallet.createRandom().connect(provider);
  const C = ethers.Wallet.createRandom().connect(provider);
  console.log("maker:", maker.address);
  console.log("takerB:", B.address, " takerC:", C.address);
  console.log("funding takers…");
  await fund(maker, B.address, "0.04");
  await fund(maker, C.address, "0.03");

  const otcM = await ethers.getContractAt("PrivateOTC", OTC, maker);

  // ───── Phase 1: Direct settlement (maker sells 3 cETH, hidden reserve 5000 cUSDC; B offers 6000) ─────
  console.log("\n[Direct] maker mints 3 cETH + creates intent…");
  await mint(maker, CETH, 3);
  await ensureOp(maker, CETH);
  const e1 = await encFor(OTC, maker.address, [3, 5000]);
  await (await otcM.createIntent(CETH, CUSDC, e1.h[0], e1.h[1], e1.p, 0, EXPIRES, ethers.ZeroAddress)).wait();
  const dId = (await otcM.nextId()) - 1n;

  console.log("[Direct] B mints 6000 cUSDC + accepts (offer 6000)…");
  await mint(B, CUSDC, 6000);
  await ensureOp(B, CUSDC);
  const e2 = await encFor(OTC, B.address, [6000]);
  const otcB = await ethers.getContractAt("PrivateOTC", OTC, B);
  await (await otcB.acceptIntent(dId, e2.h[0], e2.p)).wait();

  const bEth = await decBal(B, CETH);
  const bUsdc = await decBal(B, CUSDC);
  console.log(`[Direct] result → B: ${bEth} cETH, ${bUsdc} cUSDC  (expect 3 / 0)`);
  const directOK = bEth === 3n && bUsdc === 0n;
  console.log(directOK ? "✅ DIRECT settlement works live on Sepolia" : "❌ direct mismatch");

  // ───── Phase 2: RFQ Vickrey (maker sells 2 cETH; B bids 8000, C bids 7000; winner B pays 7000) ─────
  let rfqMsg = "";
  try {
    console.log("\n[RFQ] maker mints 2 cETH + opens auction…");
    await mint(maker, CETH, 2);
    const e3 = await encFor(OTC, maker.address, [2, 0]);
    await (await otcM.createIntent(CETH, CUSDC, e3.h[0], e3.h[1], e3.p, 1, EXPIRES, ethers.ZeroAddress)).wait();
    const rId = (await otcM.nextId()) - 1n;

    console.log("[RFQ] B bids 8000, C bids 7000…");
    await mint(B, CUSDC, 8000);
    await ensureOp(B, CUSDC);
    const eb = await encFor(OTC, B.address, [8000]);
    await (await otcB.submitBid(rId, eb.h[0], eb.p)).wait();

    await mint(C, CUSDC, 7000);
    await ensureOp(C, CUSDC);
    const ec = await encFor(OTC, C.address, [7000]);
    const otcC = await ethers.getContractAt("PrivateOTC", OTC, C);
    await (await otcC.submitBid(rId, ec.h[0], ec.p)).wait();

    console.log("[RFQ] maker finalizes…");
    await (await otcM.finalizeAuction(rId)).wait();

    const bEth2 = await decBal(B, CETH);
    const bUsdc2 = await decBal(B, CUSDC);
    const cEth2 = await decBal(C, CETH);
    const cUsdc2 = await decBal(C, CUSDC);
    console.log(`[RFQ] B: ${bEth2} cETH, ${bUsdc2} cUSDC  (expect 5 / 1000 — won, paid 2nd price 7000, refunded 1000)`);
    console.log(`[RFQ] C: ${cEth2} cETH, ${cUsdc2} cUSDC  (expect 0 / 7000 — lost, fully refunded)`);
    const rfqOK = bEth2 === 5n && bUsdc2 === 1000n && cEth2 === 0n && cUsdc2 === 7000n;
    rfqMsg = rfqOK ? "✅ RFQ Vickrey works live — winner charged the SECOND price" : "❌ rfq mismatch";
  } catch (e: any) {
    rfqMsg = "❌ RFQ finalize FAILED on Sepolia (likely HCU/gas limit): " + (e.shortMessage ?? e.message);
  }
  console.log("\n" + (directOK ? "DIRECT ✅" : "DIRECT ❌") + "   " + rfqMsg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
