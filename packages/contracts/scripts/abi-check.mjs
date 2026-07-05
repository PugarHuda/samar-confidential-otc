// Verify the frontend's hand-written ABIs match the compiled contract exactly.
// A mismatch (wrong input types / order / return types) breaks the frontend even
// though node tests (which use the compiled/typechain ABI) pass. Deterministic.
import { ethers } from "ethers";
import { readFileSync } from "fs";

// --- frontend ABIs (copied verbatim from packages/web/lib/abi.ts) ---
const tokenFront = [
  "function mint(uint64 amount)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];
const otcFront = [
  "function nextId() view returns (uint256)",
  "function createIntent(address sellToken, address buyToken, bytes32 encSell, bytes32 encMinBuy, bytes proof, uint8 mode, uint64 expiresAt, address allowedTaker) returns (uint256)",
  "function grantView(uint256 id, address viewer)",
  "function acceptIntent(uint256 id, bytes32 encOffer, bytes proof)",
  "function cancelIntent(uint256 id)",
  "function submitBid(uint256 id, bytes32 encBid, bytes proof)",
  "function finalizeAuction(uint256 id)",
  "function getBidCount(uint256 id) view returns (uint256)",
  "function hasBid(uint256 id, address bidder) view returns (bool)",
  "function getIntent(uint256 id) view returns (address maker, address sellToken, address buyToken, uint8 mode, uint8 status, uint64 expiresAt, address allowedTaker)",
  "function getSellAmount(uint256 id) view returns (bytes32)",
  "function getMinBuyAmount(uint256 id) view returns (bytes32)",
];

const compiled = (path) => JSON.parse(readFileSync(path, "utf8")).abi;

function selectorMap(abi) {
  const m = {};
  new ethers.Interface(abi).forEachFunction((f) => (m[f.selector] = f));
  return m;
}

function check(label, frontStrings, compiledAbi) {
  const cMap = selectorMap(compiledAbi);
  const front = new ethers.Interface(frontStrings);
  let issues = 0,
    n = 0;
  front.forEachFunction((ff) => {
    n++;
    const cf = cMap[ff.selector];
    if (!cf) {
      console.log(`  ✗ ${ff.format("full")} — selector ${ff.selector} not on contract (name/inputs mismatch)`);
      issues++;
      return;
    }
    const fo = ff.outputs.map((o) => o.type).join(",");
    const co = cf.outputs.map((o) => o.type).join(",");
    if (fo !== co) {
      console.log(`  ✗ ${ff.name}: return types frontend(${fo}) vs contract(${co})`);
      issues++;
    }
  });
  console.log(issues === 0 ? `${label}: ✓ all ${n} functions match the contract` : `${label}: ${issues} MISMATCH(es)`);
  return issues;
}

const c1 = check("otcAbi", otcFront, compiled("artifacts/contracts/PrivateOTC.sol/PrivateOTC.json"));
const c2 = check("tokenAbi", tokenFront, compiled("artifacts/contracts/SamarCToken.sol/SamarCToken.json"));
if (c1 + c2 > 0) process.exit(1);
