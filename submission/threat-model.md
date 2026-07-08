# Samar — Threat Model & Known Limitations

Honest scope of what Samar's `PrivateOTC` contract guarantees, and where it doesn't. Written because a
confidential-trading product should state its threat model plainly. Audited across correctness, FHE-ACL
confidentiality, and test coverage; the money math is covered by 20 passing tests with real decrypted
balance assertions.

## What IS guaranteed

**Fund safety (strong).** No path loses, strands (on logic), double-spends, or steals funds. Direct and
RFQ settlement conserve every escrowed unit — delivered or refunded — in both the clearing and the no-op
branch. Checks-effects-interactions holds (status → `Filled` before any payout) and payouts use hookless
`confidentialTransfer`, so there is no reentrancy. Verified by 20 tests including double-settle, at-reserve
boundary, tie, out-of-order second price, and the `MAX_BIDDERS` cap.

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
   finalize. The `MAX_BIDDERS = 5` cap is tuned to the measured Sepolia coprocessor HCU ceiling (5 finalize
   at ~6.2M gas; 6+ revert), which is the guard that keeps finalize from ever reverting and stranding
   escrow. A future pull-payment claim path would remove the reliance on that single tx.

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
