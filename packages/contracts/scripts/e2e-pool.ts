import { ethers } from "hardhat";
// Live Sepolia end-to-end for the Confidential PrizePool: deploys a THROWAWAY pool with a 60s
// draw period, then runs the full judged cycle against the real coprocessor + KMS:
//   mint → deposit (encrypted) → confidential sponsor → draw (snapshot → relayed KMS public
//   decryption verified on-chain → paginated select) → claim → exit (full principal, no loss).
// Asserted on user-decrypted balances. The production pool (10-min period) is untouched.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const UNTIL = 2_000_000_000;
const PERIOD = 60;
const TIERS = [7000, 2000, 1000];
const DEPOSIT = 3000n;
const RESERVE = 10_000_000n; // unit=1000 → prizes 7M/2M/1M, zero rounding dust
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));

let instance: any;

async function enc(contract: string, user: string, v: bigint) {
  const input = instance.createEncryptedInput(contract, user);
  input.add64(v);
  const e = await input.encrypt();
  return { h: HEX(e.handles[0]), p: HEX(e.inputProof) };
}

async function userDec(wallet: any, contractAddr: string, handle: string): Promise<bigint> {
  if (handle === ethers.ZeroHash) return 0n;
  const { publicKey, privateKey } = instance.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const days = 10;
  const eip = instance.createEIP712(publicKey, [contractAddr], start, days);
  const sig = await wallet.signTypedData(
    eip.domain,
    { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification },
    eip.message,
  );
  const res = await instance.userDecrypt(
    [{ handle, contractAddress: contractAddr }],
    privateKey,
    publicKey,
    sig.replace(/^0x/, ""),
    [contractAddr],
    wallet.address,
    start,
    days,
  );
  return BigInt(res[handle]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [me] = await ethers.getSigners();
  instance = await createInstance({
    ...SepoliaConfig,
    network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  });
  console.log("signer:", me.address);

  console.log("\n[1/7] deploy throwaway pool (60s period)…");
  const Pool = await ethers.getContractFactory("ConfidentialPrizePool");
  const pool = await Pool.deploy(CUSDC, PERIOD, TIERS);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("pool:", poolAddr);

  const usdc = await ethers.getContractAt("SamarCToken", CUSDC, me);
  const before = await userDec(me, CUSDC, await usdc.confidentialBalanceOf(me.address));
  console.log("cUSDC before:", before.toString());

  console.log("\n[2/7] mint + deposit (encrypted)…");
  await (await usdc.mint(DEPOSIT + RESERVE)).wait();
  if (!(await usdc.isOperator(me.address, poolAddr))) await (await usdc.setOperator(poolAddr, UNTIL)).wait();
  const d = await enc(poolAddr, me.address, DEPOSIT);
  await (await pool.deposit(d.h, d.p)).wait();
  const tickets = await userDec(me, poolAddr, await pool.confidentialBalanceOf(me.address));
  console.log("tickets:", tickets.toString(), tickets === DEPOSIT ? "✅" : "❌");

  console.log("\n[3/7] confidential sponsor of the prize reserve…");
  const s = await enc(poolAddr, me.address, RESERVE);
  await (await pool.sponsorPrize(s.h, s.p)).wait();

  console.log(`\n[4/7] wait for the draw window (${PERIOD}s)…`);
  while (BigInt(Math.floor(Date.now() / 1000)) < (await pool.nextDrawAt())) await sleep(5000);
  await (await pool.startDraw()).wait();
  console.log("draw started — relaying KMS public decryption of the total weight…");
  const handle = await pool.snapshotWeightHandle();
  const pub = await instance.publicDecrypt([handle]);
  await (await pool.seedDraw(pub.abiEncodedClearValues, pub.decryptionProof)).wait();
  console.log("seeded. total weight (public by design):", (await pool.lastDrawTotalWeight()).toString());

  console.log("\n[5/7] paginated winner selection…");
  const n = await pool.participantCount();
  while ((await pool.drawCursor()) < n) {
    const tx = await pool.drawPage(0);
    const rc = await tx.wait();
    console.log("  page done, gas:", rc!.gasUsed.toString());
  }
  if ((await pool.drawState()) !== 0n) throw new Error("draw did not complete");

  console.log("\n[6/7] claim winnings (winner-blind — everyone claims, only winners get > 0)…");
  const win = await userDec(me, poolAddr, await pool.winningsOf(me.address));
  console.log("winnings:", win.toString(), win === RESERVE ? "✅ (sole depositor won all tiers)" : "❌");
  await (await pool.claim()).wait();

  console.log("\n[7/7] exit — full principal back, no loss…");
  await (await pool.exit()).wait();
  const after = await userDec(me, CUSDC, await usdc.confidentialBalanceOf(me.address));
  const expected = before + DEPOSIT + RESERVE; // minted DEPOSIT+RESERVE, sponsored RESERVE, won RESERVE back
  console.log("cUSDC after:", after.toString(), "expected:", expected.toString());
  console.log(after === expected ? "\n✅ FULL CYCLE VERIFIED LIVE ON SEPOLIA" : "\n❌ balance mismatch");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
