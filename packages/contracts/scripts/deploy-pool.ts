import { ethers } from "hardhat";

// Deploy the Confidential PrizePool + MockYieldSource against the already-verified cUSDC faucet
// token. Draw every 10 minutes (demo cadence), tiers 70/20/10% of the reserve.
const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const DRAW_PERIOD = 600; // 10 min — judges see a full cycle quickly
const TIERS = [7000, 2000, 1000];
const APR_BPS = 1000; // 10% APR on the notional principal
// notional / 525600 = yield per 10-min draw → ~500k units (0.5 cUSDC) per draw
const NOTIONAL = 262_800_000_000n;

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address, "|", ethers.formatEther(bal), "ETH");
  if (bal === 0n) throw new Error("Deployer has 0 Sepolia ETH.");

  const Pool = await ethers.getContractFactory("ConfidentialPrizePool");
  const pool = await Pool.deploy(CUSDC, DRAW_PERIOD, TIERS);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("ConfidentialPrizePool:", poolAddr);

  const Yield = await ethers.getContractFactory("MockYieldSource");
  const ys = await Yield.deploy(CUSDC, poolAddr, APR_BPS);
  await ys.waitForDeployment();
  const ysAddr = await ys.getAddress();
  console.log("MockYieldSource      :", ysAddr);

  await (await ys.fund(NOTIONAL)).wait();
  console.log("Funded notional principal:", NOTIONAL.toString());

  console.log("\nVerify:");
  console.log(`  npx hardhat verify --network sepolia ${poolAddr} ${CUSDC} ${DRAW_PERIOD} "[${TIERS}]"`);
  console.log(`  npx hardhat verify --network sepolia ${ysAddr} ${CUSDC} ${poolAddr} ${APR_BPS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
