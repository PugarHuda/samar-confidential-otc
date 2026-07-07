"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { tokenByAddress, shortAddr, intentId, MODE, zeroAddressIsOpen, validAmount } from "@/lib/config";
import { useSamar, type IntentRow } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, Label, Button, MsIcon, StatusPill, ModePill, TokenChip, Cipher } from "@/components/ui";

export default function IntentDetail() {
  const params = useParams();
  const id = Number(params.id);
  const s = useSamar();

  const [it, setIt] = useState<IntentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<{ sell: string; minBuy: string } | null>(null);
  const [offer, setOffer] = useState("");
  const [bidAmt, setBidAmt] = useState("");
  const [bids, setBids] = useState(0);
  const [alreadyBid, setAlreadyBid] = useState(false);
  const [viewer, setViewer] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await s.loadIntents();
      const found = rows.find((r) => r.id === id) ?? null;
      setIt(found);
      if (found?.mode === 1) {
        setBids(await s.bidCount(id));
        setAlreadyBid(await s.hasBid(id));
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.address, id]);

  const run = (key: string, fn: () => Promise<void>, done?: string) => async () => {
    setErr("");
    setMsg("");
    setBusy(key);
    try {
      await fn();
      if (done) setMsg(done);
      await load();
    } catch (e: any) {
      setErr(e.shortMessage ?? e.message ?? "failed");
    } finally {
      setBusy("");
    }
  };

  const decryptTerms = run("terms", async () => {
    const h = await s.getAmountHandles(id);
    const sell = await s.decryptHandle(h.sell, s.otc);
    const minBuy = await s.decryptHandle(h.minBuy, s.otc);
    setTerms({ sell: sell.toString(), minBuy: minBuy.toString() });
  });

  if (loading)
    return (
      <Gate requireConnect={false}>
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </Gate>
    );
  if (!it)
    return (
      <Gate requireConnect={false}>
        <Panel className="text-center">Intent {intentId(id)} not found.</Panel>
      </Gate>
    );

  const sellT = tokenByAddress(it.sellToken);
  const buyT = tokenByAddress(it.buyToken);
  const mine = it.maker.toLowerCase() === s.address?.toLowerCase();
  const open = it.status === 0;
  const now = Math.floor(Date.now() / 1000);
  const expired = open && it.expiresAt < now;
  // permissioned intents: only the allowed taker (or anyone, if unset) may accept/bid
  const canTake = zeroAddressIsOpen(it.allowedTaker) || it.allowedTaker.toLowerCase() === s.address?.toLowerCase();

  return (
    <Gate requireConnect={false}>
      {(busy === "accept" || busy === "finalize") && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-page/85 backdrop-blur">
          <div className="flex flex-col items-center gap-3 text-center">
            <MsIcon name="progress_activity" size={44} className="animate-spin text-purple" />
            <p className="font-display text-lg font-600">Atomic settlement</p>
            <p className="font-mono text-[12px] text-muted">FHE.select · releasing escrow</p>
          </div>
        </div>
      )}

      <Link href="/app" className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-muted hover:text-txt">
        <MsIcon name="arrow_back" size={14} /> orderbook
      </Link>

      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-panel2 text-purple">
          <MsIcon name={it.mode === 1 ? "gavel" : "bolt"} size={22} />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-700">
              {MODE[it.mode]} OTC {intentId(id)}
            </h1>
            {expired ? <StatusPill status={4} /> : <StatusPill status={it.status} />}
            <ModePill mode={it.mode} />
          </div>
          <p className="font-mono text-[11px] text-muted">MAKER {shortAddr(it.maker)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <div className="font-mono text-[12px] text-dim">ORDER_PARAMETERS</div>
          <div className="mt-4 flex items-center gap-2">
            <TokenChip token={sellT} symbol={it.sellToken} />
            <MsIcon name="arrow_forward" size={16} className="text-faint" />
            <TokenChip token={buyT} symbol={it.buyToken} />
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <Row k="Maker">{shortAddr(it.maker)}</Row>
            <Row k={`Sell amount (${sellT?.symbol ?? "?"})`}>
              {terms ? <span className="font-mono text-txt">{Number(terms.sell).toLocaleString()}</span> : <EncRow />}
            </Row>
            <Row k={`Min buy / reserve (${buyT?.symbol ?? "?"})`}>
              {terms ? <span className="font-mono text-txt">{Number(terms.minBuy).toLocaleString()}</span> : <EncRow />}
            </Row>
            <Row k="Expires">
              <span className="font-mono text-dim">{new Date(it.expiresAt * 1000).toLocaleString()}</span>
            </Row>
            <Row k="Access">
              <span className="font-mono text-dim">{zeroAddressIsOpen(it.allowedTaker) ? "open to anyone" : `locked · ${shortAddr(it.allowedTaker)}`}</span>
            </Row>
          </dl>

          {!terms && (
            <Button variant="ghost" className="mt-5" disabled={busy === "terms"} onClick={decryptTerms}>
              {busy === "terms" ? "Decrypting…" : "Decrypt terms"}
            </Button>
          )}
          <p className="mt-4 font-mono text-[10px] text-faint">
            Amounts are encrypted. Only the maker, a granted viewer, or a settled taker can decrypt them.
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
          {/* Permissioned: locked to a specific taker that isn't you */}
          {open && !expired && !mine && !canTake && (
            <Panel className="border-yellow/20">
              <div className="flex items-center gap-1.5 font-mono text-[12px] text-yellow">
                <MsIcon name="lock" size={14} /> LOCKED_INTENT
              </div>
              <p className="mt-2 text-sm text-muted">
                This intent is permissioned — only <span className="font-mono text-txt">{shortAddr(it.allowedTaker)}</span> can
                fill it. The <span className="font-mono text-dim">allowedTaker</span> gate is enforced in the contract, so your
                wallet can&apos;t accept or bid. This is how Samar puts compliance (e.g. a KYC&apos;d counterparty) on-chain.
              </p>
            </Panel>
          )}

          {/* Taker: accept */}
          {open && !expired && !mine && canTake && it.mode === 0 && (
            <Panel>
              <div className="font-mono text-[12px] text-dim">ACCEPT_INTENT</div>
              <Label>Your offer ({buyT?.symbol})</Label>
              <input
                className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-purple/60"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                inputMode="numeric"
                placeholder="amount you pay"
              />
              <p className="mt-1 font-mono text-[10px] text-faint">
                Settles only if it clears the hidden reserve (Strategy B). No {buyT?.symbol}?{" "}
                <Link href="/app/faucet" className="text-purple underline">
                  Faucet →
                </Link>
              </p>
              {!terms && (
                <p className="mt-2 font-mono text-[10px] text-yellow">
                  ⚠ Decrypt the terms (left) first to confirm the size you&apos;ll receive before paying.
                </p>
              )}
              <Button
                variant="primary"
                className="mt-4 w-full"
                disabled={busy === "accept" || !offer}
                onClick={() => {
                  if (!validAmount(offer)) {
                    setErr("Offer must be a whole number between 1 and 1e15");
                    return;
                  }
                  run("accept", () => s.accept(id, it.buyToken, Number(offer)), "Settled — check your portfolio.")();
                }}
              >
                Encrypt offer &amp; settle
              </Button>
            </Panel>
          )}

          {/* Taker: RFQ sealed bid */}
          {open && !expired && !mine && canTake && it.mode === 1 && (
            <Panel>
              <div className="font-mono text-[12px] text-dim">SUBMIT_SEALED_BID</div>
              {alreadyBid ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-mint">
                  <MsIcon name="check_circle" size={16} /> Your bid is in — escrowed &amp; encrypted.
                </p>
              ) : (
                <>
                  <Label>Your bid ({buyT?.symbol})</Label>
                  <input
                    className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-purple/60"
                    value={bidAmt}
                    onChange={(e) => setBidAmt(e.target.value)}
                    inputMode="numeric"
                    placeholder="sealed — nobody sees it"
                  />
                  <p className="mt-1 font-mono text-[10px] text-faint">
                    Escrowed now; refunded if you don&apos;t win. Winner pays the 2nd-highest price.
                  </p>
                  <Button
                    variant="yellow"
                    className="mt-4 w-full"
                    disabled={busy === "bid" || !bidAmt}
                    onClick={() => {
                      if (!validAmount(bidAmt)) {
                        setErr("Bid must be a whole number between 1 and 1e15");
                        return;
                      }
                      run("bid", () => s.submitBid(id, it.buyToken, Number(bidAmt)), "Bid submitted.")();
                    }}
                  >
                    Encrypt &amp; submit bid
                  </Button>
                </>
              )}
            </Panel>
          )}

          {/* Maker: RFQ manage */}
          {open && mine && it.mode === 1 && (
            <Panel>
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-dim">MANAGE_AUCTION</div>
                <span className="font-mono text-[12px] text-yellow">{bids}/5 bids</span>
              </div>
              <Button
                variant="yellow"
                className="mt-4 w-full"
                disabled={busy === "finalize"}
                onClick={run("finalize", () => s.finalizeAuction(id), "Auction settled — winner charged 2nd price.")}
              >
                {busy === "finalize" ? "Finalizing…" : "Finalize auction"}
              </Button>
              {bids === 0 && (
                <Button
                  variant="ghost"
                  className="mt-2 w-full border-coral/30 text-coral"
                  disabled={busy === "cancel"}
                  onClick={run("cancel", () => s.cancel(id), "Cancelled — escrow reclaimed.")}
                >
                  {busy === "cancel" ? "Cancelling…" : "Cancel & reclaim escrow"}
                </Button>
              )}
            </Panel>
          )}

          {/* Maker: Direct manage */}
          {open && mine && it.mode === 0 && (
            <Panel>
              <div className="font-mono text-[12px] text-dim">MANAGE</div>
              <Label>Grant view to a counterparty</Label>
              <input
                className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-purple/60"
                value={viewer}
                onChange={(e) => setViewer(e.target.value)}
                placeholder="0x… taker address"
              />
              <Button
                variant="ghost"
                className="mt-3 w-full"
                disabled={busy === "grant" || viewer.length !== 42}
                onClick={run("grant", () => s.grantView(id, viewer), "Access granted.")}
              >
                {busy === "grant" ? "Granting…" : "Grant view (FHE.allow)"}
              </Button>
              <Button
                variant="ghost"
                className="mt-2 w-full border-coral/30 text-coral"
                disabled={busy === "cancel"}
                onClick={run("cancel", () => s.cancel(id), "Cancelled — escrow reclaimed.")}
              >
                {busy === "cancel" ? "Cancelling…" : "Cancel & reclaim escrow"}
              </Button>
            </Panel>
          )}

          {/* Settled */}
          {it.status === 2 && (
            <Panel className="border-filled/20">
              <div className="font-mono text-[12px] text-dim">SETTLED</div>
              <p className="mt-2 text-sm text-muted">
                This intent is closed. Under Strategy B a real fill and a no-op refund look identical on-chain — decrypt your
                own balance in Portfolio to see your outcome.
              </p>
            </Panel>
          )}

          <Panel className="border-purple/20 bg-panel2">
            <div className="flex items-start gap-2">
              <MsIcon name="shield_lock" size={18} className="text-purple" />
              <p className="text-[13px] text-muted">
                <span className="font-mono text-dim">PRIVACY_GUARANTEE:</span> size, price and reserve never appear as plaintext
                on-chain — not to bots, counterparties, or validators.
              </p>
            </div>
          </Panel>

          {msg && <p className="font-mono text-[12px] text-mint">✓ {msg}</p>}
          {err && <p className="font-mono text-[12px] text-coral">⚠ {err}</p>}
        </div>
      </div>
    </Gate>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-divider pb-2 last:border-0">
      <dt className="text-faint">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function EncRow() {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <MsIcon name="lock" size={13} className="text-faint" />
      <Cipher />
    </span>
  );
}
