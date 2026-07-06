import { ethers } from "hardhat";

// Redeploy ONLY PrivateOTC (tokens are unchanged and stay on their verified deployments).
async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(bal), "ETH");
  if (bal === 0n) throw new Error("Deployer has 0 Sepolia ETH. Fund it first, then re-run.");

  const OTC = await ethers.getContractFactory("PrivateOTC");
  const otc = await OTC.deploy();
  await otc.waitForDeployment();
  const addr = await otc.getAddress();
  console.log("\nPrivateOTC deployed:", addr);
  console.log("\nUpdate NEXT_PUBLIC_PRIVATE_OTC + docs, then:");
  console.log(`  npx hardhat verify --network sepolia ${addr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
