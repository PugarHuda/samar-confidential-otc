# Samar — Threat Model & Known Limitations

Honest scope of what Samar's `PrivateOTC` contract guarantees, and where it doesn't. Written because a
confidential-trading product should state its threat model plainly. Audited across correctness, FHE-ACL
confidentiality, and test coverage; the money math is covered by 21 passing tests with real decrypted
balance assertions.

## What IS guaranteed

**Fund safety (strong).** No path loses, strands (on logic), double-spends, or steals funds. Direct and
RFQ settlement conserve every escrowed unit — delivered or refunded — in both the clearing and the no-op
branch. Checks-effects-interactions holds (status → `Filled` before any payout) and payouts use hookless
`confidentialTransfer`, so there is no reentrancy. Verified by 21 tests including double-settle, at-reserve
boundary, tie, out-of-order second price, the `MAX_BIDDERS` cap, and maker-self-decrypt.

**Confidentiality vs. third parties (strong).** Order size, price, and the maker's hidden reserve never
appear as plaintext on-chain. Bots, competitors, and validators see only public metadata (token pair,
expiry, maker/bidder addresses, bid count) — never an amount. Strategy B makes a filled Direct trade
on-chain-indistinguishable from a no-op refund: both branches always emit the same set of encrypted
transfers, gas is constant, and nothing reverts on a secret.

**RFQ winner identity (hidden, incl. from the maker).** The maker's auction proceeds are aggregated into a
single encrypted transfer paid once after the settlement loop — so the maker cannot correlate a non-zero
payout row back to a bidder. No one learns who won from on-chain data.

## Known limitations (accepted for this submission)

These are inherent trade-offs of the privacy design, not fund bugs. Fixing them properly requires a
contract redesign, so they are documented rather than patched.

1. **Open Direct intents are grief-able to `Filled` (liveness, no fund loss).** Because settlement can never
   reveal "offer too low" by reverting, an intent is always marked `Filled` after an accept — even a no-op
   from a zero-balance caller. Anyone can therefore close an open, unlocked Direct intent for the cost of
   gas; the maker keeps their asset (refunded) but must re-create the intent. Mitigation today: lock a trade
   to a known counterparty via `allowedTaker`.

2. **RFQ bid slots can be exhausted.** `MAX_BIDDERS` is 5, so five zero-value bids from five addresses can
   lock out later bidders. Mitigation: `allowedTaker`, or a maker who finalizes promptly.

3. **`finalizeAuction` has no per-bidder recovery fallback.** Escrowed bids exit only through a successful
   finalize. The `MAX_BIDDERS = 5` cap is tuned to the Sepolia coprocessor HCU ceiling, which is the guard
   that keeps finalize from ever reverting and stranding escrow. A future pull-payment claim path would
   remove the reliance on that single tx. The per-bidder cost is dominated by **2 confidential-token
   transfers per bidder** (asset + refund), which is irreducible without leaking the winner — so ~5 is
   near-structural, not an inefficiency.

## Gas / HCU
Measured live on Sepolia (`0x1F44…cd78`): `finalizeAuction` costs **~379k gas (0 bidders)** + **~1.06M
gas/bidder** → ~5.7M at 5 bidders, well under the 16.7M per-tx cap. The winner-anonymity fix (aggregating
the maker's proceeds into one transfer) cut the per-bidder transfer count from 3 to 2, lowering finalize
gas ~8% vs the prior design. A gas pass then removed redundant `FHE.allow` grants on escrowed handles (the
token's `_update` already grants them), folded a per-bidder `FHE.select` in the settlement loop, and cached
warm SLOADs — all behavior-preserving (21 tests green). The `Intent` struct is already minimally packed
(6 slots).

4. **`grantView` intentionally reveals the reserve to the invited viewer.** For a directed quote, the maker
   grants a chosen counterparty decrypt rights to both size and reserve so they can make a clearing offer.
   That viewer (and only that viewer) sees the floor; it stays hidden from everyone else.

5. **The Vickrey winner can derive the clearing (second) price** from their own bid and refund — inherent to
   any second-price auction. They do not learn who placed it.

6. **`maker` may finalize an RFQ before expiry.** A deliberate UX choice (the maker closes when satisfied);
   it remains fund-correct. If timed fairness matters, gate the maker branch on expiry too.

7. **`SamarCToken.mint` faucet can be saturated (testnet griefing).** `mint` is unbounded; a single
   `mint(type(uint64).max)` pushes total supply to the ceiling, after which the ERC-7984 base's
   `tryIncrease` returns a silent no-op for everyone (mints credit 0, no revert). A griefer could brick a
   faucet before judging. Testnet-only and easily re-deployed; a per-call/per-address cap fixes it.

## Not in scope
Testnet only. `SamarCToken.mint` takes a public amount by design (faucet). Keys used in demo scripts are
throwaway testnet keys.
