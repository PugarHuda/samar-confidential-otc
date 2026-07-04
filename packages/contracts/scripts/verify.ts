import { ethers } from "hardhat";

// Live Sepolia smoke test: mint a confidential token and confirm the balance handle is set.
// Proves the FHE coprocessor accepts our contract's ops (asEuint64 + _mint + ACL) on-chain.
const CUSDC = "0x25fb7981e5D6A6400cBefA1efFcF6E80c8c6aAf7";

async function main() {
  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt("SamarCToken", CUSDC, signer);

  console.log("Minting 1000 cUSDC to", signer.address, "…");
  const tx = await token.mint(1000);
  await tx.wait();
  console.log("Mint tx:", tx.hash);

  const handle: string = await token.confidentialBalanceOf(signer.address);
  console.log("Balance handle:", handle);
  console.log(handle !== ethers.ZeroHash ? "✅ FHE path live on Sepolia (handle is set)" : "❌ handle empty — mint did not register");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
