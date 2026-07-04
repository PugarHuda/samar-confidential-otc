import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(bal), "ETH");
  if (bal === 0n) {
    throw new Error("Deployer has 0 Sepolia ETH. Fund it first (e.g. a Sepolia faucet), then re-run.");
  }

  const Token = await ethers.getContractFactory("SamarCToken");
  const usdc = await Token.deploy("Confidential USDC", "cUSDC", "");
  await usdc.waitForDeployment();
  const eth = await Token.deploy("Confidential ETH", "cETH", "");
  await eth.waitForDeployment();

  const OTC = await ethers.getContractFactory("PrivateOTC");
  const otc = await OTC.deploy();
  await otc.waitForDeployment();

  const out = {
    cUSDC: await usdc.getAddress(),
    cETH: await eth.getAddress(),
    PrivateOTC: await otc.getAddress(),
  };
  console.log("\nDeployed:");
  console.table(out);
  console.log("\nPaste into packages/web/lib/config.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
