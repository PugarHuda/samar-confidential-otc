import { ethers } from "hardhat";
// Live Sepolia end-to-end of the FULL relayer round-trip (encrypt -> createIntent -> user-decrypt).
// Proves the exact FHE flow the frontend depends on works against the real relayer + coprocessor.
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CUSDC = "0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e";
const CETH = "0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c";
const OTC = "0x880a9c4dbB3b2749a8F11011B9ed7D8c74B0C35F";
const HEX = (h: any) => (typeof h === "string" ? (h.startsWith("0x") ? h : "0x" + h) : ethers.hexlify(h));

async function main() {
  const [signer] = await ethers.getSigners();
  const me = signer.address;
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

  console.log("creating relayer instance…");
  const instance = await createInstance({ ...SepoliaConfig, network: rpc });

  const eth = await ethers.getContractAt("SamarCToken", CETH, signer);
  const otc = await ethers.getContractAt("PrivateOTC", OTC, signer);

  console.log("mint 5 cETH + setOperator…");
  await (await eth.mint(5)).wait();
  if (!(await eth.isOperator(me, OTC))) await (await eth.setOperator(OTC, 2_000_000_000)).wait();

  console.log("encrypting sell=5, minBuy=9000 via relayer…");
  const input = instance.createEncryptedInput(OTC, me);
  input.add64(5);
  input.add64(9000);
  const enc = await input.encrypt();

  console.log("createIntent on Sepolia…");
  const tx = await otc.createIntent(
    CETH,
    CUSDC,
    HEX(enc.handles[0]),
    HEX(enc.handles[1]),
    HEX(enc.inputProof),
    0,
    2_000_000_000,
    ethers.ZeroAddress,
  );
  await tx.wait();
  console.log("  tx:", tx.hash);

  const id = (await otc.nextId()) - 1n;
  const info = await otc.getIntent(id);
  console.log(`  intent #${id} status=${info.status} maker=${info.maker}`);

  console.log("user-decrypting the escrowed sellAmount (maker has ACL)…");
  const sellHandle: string = await otc.getSellAmount(id);
  const { publicKey, privateKey } = instance.generateKeypair();
  const start = Math.floor(Date.now() / 1000); // seconds — must be a number, not string
  const days = 10;
  const contracts = [OTC];
  const eip712 = instance.createEIP712(publicKey, contracts, start, days);
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );
  const res = await instance.userDecrypt(
    [{ handle: sellHandle, contractAddress: OTC }],
    privateKey,
    publicKey,
    signature.replace(/^0x/, ""),
    contracts,
    me,
    start,
    days,
  );
  const clear = res[sellHandle].toString();
  console.log("  decrypted sellAmount:", clear);
  console.log(clear === "5" ? "\n✅ FULL relayer round-trip works on Sepolia" : "\n❌ decrypt mismatch");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
