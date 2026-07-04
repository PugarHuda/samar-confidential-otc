import { ethers } from "hardhat";
// Live Sepolia proof of the wrapper flow: mint a public ERC-20 mock -> wrap into the official
// confidential ERC-7984 wrapper -> decrypt the confidential balance. Verifies the Wrapper
// Registry app's core path against Zama's deployed contracts.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF"; // USDC Mock (public ERC-20)
const CUSDC = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639"; // cUSDCMock (ERC-7984 wrapper)

const erc20 = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];
const wrapAbi = [
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
];

async function main() {
  const [me] = await ethers.getSigners();
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const instance = await createInstance({ ...SepoliaConfig, network: rpc });

  const token = new ethers.Contract(USDC, erc20, me);
  const cToken = new ethers.Contract(CUSDC, wrapAbi, me);
  const dec = Number(await token.decimals());
  const amt = 1000n * 10n ** BigInt(dec);

  console.log(`mint 1000 USDC Mock (dec=${dec})…`);
  await (await token.mint(me.address, amt)).wait();
  console.log("approve wrapper…");
  await (await token.approve(CUSDC, amt)).wait();
  console.log("wrap → confidential cUSDCMock…");
  await (await cToken.wrap(me.address, amt)).wait();

  const handle: string = await cToken.confidentialBalanceOf(me.address);
  console.log("confidential balance handle:", handle);
  if (handle === ethers.ZeroHash) throw new Error("balance handle empty — wrap did not credit");

  // user-decrypt via relayer (numeric start/days)
  const { publicKey, privateKey } = instance.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const days = 10;
  const eip = instance.createEIP712(publicKey, [CUSDC], start, days);
  const sig = await me.signTypedData(eip.domain, { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification }, eip.message);
  const res = await instance.userDecrypt(
    [{ handle, contractAddress: CUSDC }],
    privateKey,
    publicKey,
    sig.replace(/^0x/, ""),
    [CUSDC],
    me.address,
    start,
    days,
  );
  const clear = BigInt(res[handle]);
  console.log("decrypted confidential balance:", clear.toString());
  console.log(clear > 0n ? "\n✅ Wrapper flow works live on Sepolia (wrap + decrypt)" : "\n❌ decrypted zero");
  if (clear === 0n) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
