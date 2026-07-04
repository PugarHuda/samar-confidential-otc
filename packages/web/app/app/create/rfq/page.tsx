"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOKENS } from "@/lib/config";
import { useSamar } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, Label, Button, Segmented, MsIcon } from "@/components/ui";

const WINDOWS: [string, number][] = [
  ["30M", 1800],
  ["1H", 3600],
  ["6H", 21600],
  ["1D", 86400],
];

export default function RfqForm() {
  const s = useSamar();
  const router = useRouter();
  const [sellKey, setSellKey] = useState<"cUSDC" | "cETH">("cETH");
  const sell = TOKENS.find((t) => t.key === sellKey)!;
  const buy = TOKENS.find((t) => t.key !== sellKey)!;
  const [sellAmt, setSellAmt] = useState("5");
  const [win, setWin] = useState(3600);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (Number(sellAmt) <= 0) {
      setErr("amount must be > 0");
      return;
    }
    setBusy(true);
    try {
      await s.createRFQ({
        sellToken: sell.address,
        buyToken: buy.address,
        sell: Number(sellAmt),
        expiresAt: Math.floor(Date.now() / 1000) + win,
      });
      router.push("/app");
    } catch (e: any) {
      setErr(e.shortMessage ?? e.message ?? "failed");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm text-txt outline-none focus:border-purple/60";

  return (
    <Gate>
      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-page/80 backdrop-blur">
          <div className="flex flex-col items-center gap-3">
            <MsIcon name="progress_activity" size={40} className="animate-spin text-yellow" />
            <p className="font-mono text-[13px] text-dim">Opening sealed auction…</p>
          </div>
        </div>
      )}

      <Link href="/app/create" className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-muted hover:text-txt">
        <MsIcon name="arrow_back" size={14} /> modes
      </Link>
      <h1 className="font-display text-2xl font-700">RFQ · Sealed-bid Vickrey</h1>
      <p className="mb-6 font-mono text-[12px] text-muted">N_TAKERS · SECOND_PRICE · MAX_10_BIDDERS</p>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <Label>Sell token</Label>
          <Segmented
            value={sellKey}
            onChange={(v) => setSellKey(v)}
            options={[
              { label: "cETH", value: "cETH" },
              { label: "cUSDC", value: "cUSDC" },
            ]}
          />

          <div className="mt-4">
            <Label>
              Sell amount <span className="ml-1 rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-yellow">HIDDEN</span>
            </Label>
            <input className={field} value={sellAmt} onChange={(e) => setSellAmt(e.target.value)} inputMode="numeric" />
            <p className="mt-1 font-mono text-[10px] text-faint">Takers see the asset pair only — never the size.</p>
          </div>

          <div className="mt-4">
            <Label>Bidding window</Label>
            <Segmented value={win} onChange={(v) => setWin(v)} options={WINDOWS.map(([l, v]) => ({ label: l, value: v }))} />
          </div>

          <div className="mt-3 rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm text-dim">
            Takers bid in <span className="font-600 text-txt">{buy.symbol}</span>
          </div>

          <Button variant="yellow" className="mt-6 w-full" disabled={busy} onClick={submit}>
            Open auction
          </Button>
          {err && <p className="mt-3 font-mono text-[12px] text-coral">⚠ {err}</p>}
        </Panel>

        <Panel className="bg-panel2">
          <div className="font-mono text-[12px] text-dim">VICKREY_RULES</div>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="text-yellow">›</span> Up to 10 takers submit sealed encrypted bids.
            </li>
            <li className="flex gap-2">
              <span className="text-yellow">›</span> Highest bid wins the asset.
            </li>
            <li className="flex gap-2">
              <span className="text-yellow">›</span> Winner pays the <span className="text-txt">second-highest</span> price.
            </li>
            <li className="flex gap-2">
              <span className="text-yellow">›</span> Every comparison runs on encrypted handles — winner &amp; clearing price
              never revealed on-chain.
            </li>
          </ul>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-page p-3 font-mono text-[11px] leading-relaxed text-faint">{`ebool newHigh = FHE.gt(cand, highest);
second  = FHE.select(newHigh, highest, second);
highest = FHE.select(newHigh, cand, highest);
// winner pays 'second', refunded the overpay`}</pre>
        </Panel>
      </div>
    </Gate>
  );
}
