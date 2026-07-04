"use client";

import { useState } from "react";
import { TOKENS } from "@/lib/config";
import { useSamar } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, Button, MsIcon, Cipher } from "@/components/ui";

export default function Portfolio() {
  const s = useSamar();
  const [values, setValues] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const toggle = (key: string, token: `0x${string}`) => async () => {
    setErr("");
    if (values[key] !== undefined) {
      setValues((v) => ({ ...v, [key]: undefined }));
      return;
    }
    setBusy(key);
    try {
      const v = await s.decryptBalance(token);
      setValues((prev) => ({ ...prev, [key]: v.toString() }));
    } catch (e: any) {
      setErr(e.shortMessage ?? e.message ?? "decrypt failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <Gate>
      <h1 className="font-display text-2xl font-700">Portfolio</h1>
      <p className="mb-6 font-mono text-[12px] text-muted">CONFIDENTIAL_BALANCES · DECRYPT_LOCALLY</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOKENS.map((t) => {
          const shown = values[t.key];
          return (
            <Panel key={t.key}>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-page" style={{ background: t.color }}>
                  {t.glyph}
                </span>
                <div className="font-display text-lg font-600">{t.symbol}</div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-2xl">
                <MsIcon name={shown !== undefined ? "lock_open" : "lock"} size={20} className="text-faint" />
                {shown !== undefined ? (
                  <span className="font-mono font-700 text-txt">{Number(shown).toLocaleString()}</span>
                ) : (
                  <Cipher className="text-xl" />
                )}
              </div>
              <Button variant="ghost" className="mt-5 w-full" disabled={busy === t.key} onClick={toggle(t.key, t.address)}>
                {busy === t.key ? "Decrypting…" : shown !== undefined ? "Hide" : "Decrypt"}
              </Button>
            </Panel>
          );
        })}
      </div>

      {err && <p className="mt-4 font-mono text-[12px] text-coral">⚠ {err}</p>}
      <p className="mt-6 max-w-lg font-mono text-[11px] leading-relaxed text-faint">
        Decryption happens locally via the Relayer SDK (re-encryption to your key). The chain never exposes plaintext — only you,
        holding the key, can read your balance.
      </p>
    </Gate>
  );
}
