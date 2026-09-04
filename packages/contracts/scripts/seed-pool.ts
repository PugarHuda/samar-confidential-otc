import { ethers } from "hardhat";
// One-off: seed the production pool with a deposit from the deployer + two fresh funded savers,
// so judges land on a live pool (participants, weights, history) instead of an empty one.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const POOL = "0xe7bFfFF46fAc9FBA8e2cF4265C65c16BAD47EA69";
const UNTIL = 2_000_000_000;
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));

async function depositAs(instance: any, wallet: any, units: bigint) {
  const usdc = await ethers.getContractAt("SamarCToken", CUSDC, wallet);
  await (await usdc.mint(units)).wait();
  if (!(await usdc.isOperator(wallet.address, POOL))) await (await usdc.setOperator(POOL, UNTIL)).wait();
  const input = instance.createEncryptedInput(POOL, wallet.address);
  input.add64(units);
  const enc = await input.encrypt();
  const pool = await ethers.getContractAt("ConfidentialPrizePool", POOL, wallet);
  await (await pool.deposit(HEX(enc.handles[0]), HEX(enc.inputProof))).wait();
  console.log("deposited", units.toString(), "as", wallet.address);
}

async function main() {
  const [me] = await ethers.getSigners();
  const instance = await createInstance({
    ...SepoliaConfig,
    network: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  });

  await depositAs(instance, me, 2_500_000_000n); // 2,500 cUSDC

  for (const eth of ["0.02", "0.02"]) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    await (await me.sendTransaction({ to: w.address, value: ethers.parseEther(eth) })).wait();
    await depositAs(instance, w, BigInt(400 + Math.floor(Math.random() * 1200)) * 1_000_000n);
  }
  console.log("done — run keeper:pool once the countdown hits zero");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
