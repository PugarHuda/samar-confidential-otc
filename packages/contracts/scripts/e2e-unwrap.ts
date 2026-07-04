import { ethers } from "hardhat";
// Live Sepolia proof of the UNWRAP half: wrap into the confidential ERC-7984, then unwrap back and
// wait for the Gateway to finalize + return the public ERC-20. Confirms unwrap actually completes
// on-chain (the async half the app couldn't verify).
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const CUSDC = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const erc20 = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const wrapAbi = [
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
];

async function main() {
  const [me] = await ethers.getSigners();
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const ethBal = await ethers.provider.getBalance(me.address);
  console.log("deployer:", me.address, "ETH:", ethers.formatEther(ethBal));

  const instance = await createInstance({ ...SepoliaConfig, network: rpc });
  const token = new ethers.Contract(USDC, erc20, me);
  const cToken = new ethers.Contract(CUSDC, wrapAbi, me);
  const dec = Number(await token.decimals());
  const one = 10n ** BigInt(dec);

  console.log("wrap 1000 to ensure confidential balance…");
  await (await token.mint(me.address, 1000n * one)).wait();
  await (await token.approve(CUSDC, 1000n * one)).wait();
  await (await cToken.wrap(me.address, 1000n * one)).wait();

  const pre: bigint = await token.balanceOf(me.address);
  console.log("underlying USDC before unwrap:", (pre / one).toString());

  console.log("encrypt unwrap amount (500) + request unwrap…");
  const input = instance.createEncryptedInput(CUSDC, me.address);
  input.add64(Number(500n * one));
  const enc = await input.encrypt();
  await (await cToken.unwrap(me.address, me.address, HEX(enc.handles[0]), HEX(enc.inputProof))).wait();

  console.log("waiting for the Gateway to finalize + return the ERC-20…");
  let done = false;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const now: bigint = await token.balanceOf(me.address);
    if (now > pre) {
      console.log(`\n✅ Unwrap finalized live — received ${((now - pre) / one).toString()} USDC back (after ~${(i + 1) * 5}s)`);
      done = true;
      break;
    }
  }
  if (!done) {
    console.log("\n⚠ ERC-20 not returned within ~120s — unwrap likely needs an explicit finalizeUnwrap call (Gateway did not auto-finalize).");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
