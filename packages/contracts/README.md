# Samar contracts — PrivateOTC + SamarCToken

Hardhat + Zama fhEVM (Solidity 0.8.27, optimizer + `viaIR`). The full protocol writeup is in the [root README](../../README.md).

- **`PrivateOTC.sol`** — the confidential OTC desk. Direct mode (encrypted intent + hidden reserve + atomic Strategy-B settlement) and RFQ mode (sealed-bid Vickrey second-price, floored at the maker's encrypted reserve, unique winner on a top tie, `MAX_BIDDERS = 5`).
- **`SamarCToken.sol`** — minimal ERC-7984 confidential token with an open faucet (deployed as cUSDC + cETH).

## Deployed (Sepolia, Etherscan-verified)

| Contract | Address |
|---|---|
| PrivateOTC | `0x7bde6aC99D3Df939941232159b2E675ACBD5A932` |
| cUSDC | `0x6BC0f17C25505795E441D9bCd1A5E0331eB5097e` |
| cETH | `0x0700c9300D5cfD8A4b2C7fBbaB2703087AB0590c` |

## Commands

```bash
npm install
npm test                                  # 20 passing (Direct + RFQ Vickrey, real balance assertions)
npm run deploy:sepolia                     # deploy cUSDC / cETH / PrivateOTC (needs PRIVATE_KEY + Sepolia ETH)
npx hardhat run scripts/deploy-otc.ts --network sepolia   # redeploy only PrivateOTC
npx hardhat verify --network sepolia <addr>
```

## Live proofs (reproducible)

- `scripts/e2e-settle.ts` — Direct trade + 2-bidder RFQ Vickrey, asserted on decrypted balances.
- `scripts/e2e.ts` — relayer round-trip (encrypt → create → decrypt).
- `scripts/stress-rfq.ts` (`BIDDERS=N`) + `scripts/finalize-only.ts` — the live HCU-ceiling probes behind `MAX_BIDDERS = 5` (6+ bidders revert on the coprocessor's HCU limit, which would strand escrow).

Set `PRIVATE_KEY` + optional `SEPOLIA_RPC_URL` + `ETHERSCAN_API_KEY` in `.env` (git-ignored) — see `.env.example`.
