"use client";

import { useEffect, useState } from "react";
import { TOKENS } from "@/lib/config";
import { useSamar } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, Button, MsIcon } from "@/components/ui";

export default function FaucetPage() {
  const s = useSamar();
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function refresh() {
    const a: Record<string, boolean> = {};
    for (const t of TOKENS) {
      try {
        a[t.key] = (await s.isOperator(t.address)) as boolean;
      } catch {
        a[t.key] = false;
      }
    }
    setAuthorized(a);
  }
  useEffect(() => {
    if (s.address) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.address]);

  const run = (key: string, fn: () => Promise<void>) => async () => {
    setErr("");
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setErr(e.shortMessage ?? e.message ?? "failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <Gate>
      <h1 className="font-display text-2xl font-700">Faucet</h1>
      <p className="mb-6 font-mono text-[12px] text-muted">MINT_DEMO_TOKENS | AUTHORIZE_SAMAR_ONCE</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOKENS.map((t) => (
          <Panel key={t.key}>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-page" style={{ background: t.color }}>
                {t.glyph}
              </span>
              <div>
                <div className="font-display text-lg font-600">{t.symbol}</div>
                <div className="font-mono text-[11px] text-muted">confidential ERC-7984</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" disabled={!!busy} onClick={run(`mint-${t.key}`, () => s.mint(t.address, t.faucet))}>
                {busy === `mint-${t.key}` ? "Minting…" : `Mint ${t.faucet.toLocaleString()} ${t.symbol}`}
              </Button>

              {authorized[t.key] ? (
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-mint/30 py-2.5 font-mono text-[12px] text-mint">
                  <MsIcon name="check_circle" size={16} /> Authorized
                </div>
              ) : (
                <Button variant="ghost" disabled={!!busy} onClick={run(`auth-${t.key}`, () => s.ensureOperator(t.address))}>
                  {busy === `auth-${t.key}` ? "Authorizing…" : "Authorize Samar"}
                </Button>
              )}
            </div>
          </Panel>
        ))}
      </div>

      {err && <p className="mt-4 font-mono text-[12px] text-coral">⚠ {err}</p>}
      <p className="mt-6 max-w-lg font-mono text-[11px] leading-relaxed text-faint">
        Authorization is a one-time ERC-7984 <span className="text-dim">setOperator</span> (60-day expiry) that lets the Samar
        contract escrow your tokens. Required before you can create or fill an intent.
      </p>
    </Gate>
  );
}
