import { ethers } from "hardhat";

// Finalize an already-populated RFQ intent with an explicit gasLimit (skips estimateGas, so the
// fhevm hardhat plugin doesn't try to simulate). Reveals the real on-chain HCU outcome.
// Usage: ID=2 GAS=20000000 npx hardhat run scripts/finalize-only.ts --network sepolia
const OTC = "0x7bde6aC99D3Df939941232159b2E675ACBD5A932";
const ID = BigInt(process.env.ID || "2");
const GAS = BigInt(process.env.GAS || "20000000");

async function main() {
  const [maker] = await ethers.getSigners();
  const otc = await ethers.getContractAt("PrivateOTC", OTC, maker);
  const bids = await otc.getBidCount(ID);
  const it = await otc.getIntent(ID);
  console.log(`intent ${ID}: status=${it.status} bids=${bids} — finalizing with gasLimit=${GAS}`);
  if (Number(it.status) !== 0) return console.log("not Open — already settled, nothing to do.");

  try {
    const tx = await otc.finalizeAuction(ID, { gasLimit: GAS });
    console.log("sent:", tx.hash, "— waiting…");
    const rc = await tx.wait();
    console.log(`\n${rc?.status === 1 ? "✅ SUCCEEDED" : "❌ MINED BUT REVERTED"} — gasUsed=${rc?.gasUsed?.toString()} (${bids} bidders)`);
  } catch (e: any) {
    console.log(`\n❌ FAILED — ${e.shortMessage ?? e.message ?? e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
