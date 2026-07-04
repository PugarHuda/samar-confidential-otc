"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOKENS } from "@/lib/config";
import { useSamar } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, Label, Button, Segmented, MsIcon } from "@/components/ui";

const EXPIRIES: [string, number][] = [
  ["1H", 3600],
  ["6H", 21600],
  ["1D", 86400],
  ["1W", 604800],
];

export default function DirectForm() {
  const s = useSamar();
  const router = useRouter();
  const [sellKey, setSellKey] = useState<"cUSDC" | "cETH">("cETH");
  const sell = TOKENS.find((t) => t.key === sellKey)!;
  const buy = TOKENS.find((t) => t.key !== sellKey)!;
  const [sellAmt, setSellAmt] = useState("5");
  const [minBuy, setMinBuy] = useState("9000");
  const [exp, setExp] = useState(86400);
  const [taker, setTaker] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (Number(sellAmt) <= 0 || Number(minBuy) <= 0) {
      setErr("amounts must be > 0");
      return;
    }
    if (taker && taker.length !== 42) {
      setErr("allowed taker must be a full 0x address or empty");
      return;
    }
    setBusy(true);
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + exp;
      await s.createDirect({
        sellToken: sell.address,
        buyToken: buy.address,
        sell: Number(sellAmt),
        minBuy: Number(minBuy),
        expiresAt,
        allowedTaker: taker.trim(),
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
            <MsIcon name="progress_activity" size={40} className="animate-spin text-purple" />
            <p className="font-mono text-[13px] text-dim">Encrypting &amp; broadcasting… FHE.fromExternal</p>
          </div>
        </div>
      )}

      <Link href="/app/create" className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-muted hover:text-txt">
        <MsIcon name="arrow_back" size={14} /> modes
      </Link>
      <h1 className="font-display text-2xl font-700">Direct OTC</h1>
      <p className="mb-6 font-mono text-[12px] text-muted">ONE_MAKER · ONE_TAKER · END_TO_END_ENCRYPTED</p>

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
            <p className="mt-1 font-mono text-[10px] text-faint">Encrypted on submit via FHE.fromExternal</p>
          </div>

          <div className="my-4 flex items-center justify-center">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line2 bg-panel2 text-muted">
              <MsIcon name="swap_vert" size={18} />
            </span>
          </div>

          <Label>Buy token</Label>
          <div className="rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm text-dim">{buy.symbol} (the other asset)</div>

          <div className="mt-4">
            <Label>
              Min buy amount <span className="ml-1 rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-yellow">HIDDEN</span>
            </Label>
            <input className={field} value={minBuy} onChange={(e) => setMinBuy(e.target.value)} inputMode="numeric" />
            <p className="mt-1 font-mono text-[10px] text-faint">Hidden reserve — enforced by Strategy B</p>
          </div>

          <div className="mt-4">
            <Label>Expires in</Label>
            <Segmented value={exp} onChange={(v) => setExp(v)} options={EXPIRIES.map(([l, v]) => ({ label: l, value: v }))} />
          </div>

          <div className="mt-4">
            <Label>Allowed taker</Label>
            <input className={field} placeholder="0x… (empty = open to anyone)" value={taker} onChange={(e) => setTaker(e.target.value)} />
            <p className="mt-1 font-mono text-[10px] text-faint">Empty = open · 0x… = locked (only that address can fill)</p>
          </div>

          <Button variant="primary" className="mt-6 w-full" disabled={busy} onClick={submit}>
            Encrypt &amp; broadcast
          </Button>
          {err && <p className="mt-3 font-mono text-[12px] text-coral">⚠ {err}</p>}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="bg-panel2">
            <div className="font-mono text-[12px] text-dim">ENCRYPTION_PIPELINE</div>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-3">
                <span className="font-mono text-purple">01</span> Encrypt off-chain via Relayer SDK → handle + input proof
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-purple">02</span> Sign &amp; broadcast to Sepolia (escrows your sell side)
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-purple">03</span> Confirm &amp; parse <span className="font-mono text-dim">IntentCreated</span>
              </li>
            </ol>
          </Panel>
          <Panel className="border-purple/20">
            <div className="font-mono text-[12px] text-dim">STRATEGY_B_NOTE</div>
            <p className="mt-2 text-sm text-muted">
              Your reserve stays encrypted. A taker&apos;s offer settles atomically only if it clears the reserve; otherwise it&apos;s
              a no-op refund. Status is always <span className="text-filled">Filled</span> — rejection never leaks.
            </p>
          </Panel>
        </div>
      </div>
    </Gate>
  );
}
