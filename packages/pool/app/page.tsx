"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Gate } from "@/components/Gate";
import { MsIcon, Cipher, Panel, Label, Button, Stat } from "@/components/ui";
import { usePool, type PoolStatus, type DrawRow } from "@/lib/usePool";
import { ADDRESSES, DRAW_STATE, ETHERSCAN, FAUCET_TOKENS, fmtUnits, toUnits, validAmount } from "@/lib/config";

// ---------------------------------------------------------------- helpers

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtCountdown(s: number) {
  if (s <= 0) return "now";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

const errMsg = (e: any): string => {
  const m = String(e?.shortMessage ?? e?.message ?? e);
  if (/user rejected|denied/i.test(m)) return "Transaction rejected in wallet.";
  if (/draw in progress/i.test(m)) return "A draw is running — deposits/withdrawals unlock when it completes (seconds).";
  if (/draw not due/i.test(m)) return "The draw isn't due yet.";
  if (/nothing to claim/i.test(m)) return "Nothing to claim yet — join a draw first.";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
};

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {["🎉", "✨", "🎊", "💜", "✨", "🎉", "💛", "🎊"].map((c, i) => (
        <span
          key={i}
          className="confetti absolute text-xl"
          style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 0.12}s` }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple font-display text-lg font-700 text-white">◎</span>
          <div>
            <div className="font-display text-lg font-700">Samar Saving</div>
            <div className="font-mono text-[11px] text-muted">confidential prize savings · zama fhevm · sepolia</div>
          </div>
        </div>
        <ConnectButton showBalance={false} />
      </header>
      <Gate>
        <App />
      </Gate>
    </main>
  );
}

function App() {
  const p = usePool();
  const now = useNow();
  const [st, setSt] = useState<PoolStatus | null>(null);
  const [rows, setRows] = useState<DrawRow[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([p.status(), p.history()]);
      setSt(s);
      setRows(h);
    } catch {
      /* transient RPC hiccup — next poll retries */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const due = st ? now >= st.nextDrawAt && st.participantCount > 0 : false;

  return (
    <div className="space-y-4">
      {/* stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Next draw">
          {st ? (st.drawState !== 0 ? <span className="text-yellow">running…</span> : fmtCountdown(st.nextDrawAt - now)) : "…"}
        </Stat>
        <Stat label="Draw state">
          <span className={st?.drawState === 0 ? "text-mint" : "text-yellow"}>{st ? DRAW_STATE[st.drawState] : "…"}</span>
        </Stat>
        <Stat label="Savers">{st ? st.participantCount : "…"}</Stat>
        <Stat label="Prize reserve">
          <span className="inline-flex items-center gap-1.5">
            <MsIcon name="lock" size={15} className="text-purple" />
            <Cipher />
          </span>
        </Stat>
        <Stat label="Mock yield APR">{st ? (st.yieldAprBps / 100).toFixed(1) + "%" : "…"}</Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SaveCard onDone={refresh} frozen={st ? st.drawState !== 0 : false} />
        <MyNumbersCard totalWeight={st?.lastDrawTotalWeight ?? 0n} />
        <WinningsCard onDone={refresh} />
      </div>

      <DrawPanel st={st} due={due} onDone={refresh} />
      <History rows={rows} />
      <Fairness />
    </div>
  );
}

// ---------------------------------------------------------------- save card

function SaveCard({ onDone, frozen }: { onDone: () => void; frozen: boolean }) {
  const p = usePool();
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg("");
    try {
      await fn();
      setMsg("✓ done");
      onDone();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy("");
    }
  }

  const ok = validAmount(amt);
  return (
    <Panel>
      <Label>Save — no loss, encrypted</Label>
      <p className="mb-3 text-[13px] text-dim">
        Deposit cUSDC for prize tickets 1:1. The amount is <span className="text-txt">encrypted on-chain</span> — nobody sees your
        balance or your odds. Withdraw your full principal any time.
      </p>
      {frozen && (
        <p className="mb-3 rounded-lg border border-yellow/30 bg-yellow/5 px-3 py-2 text-[12px] text-yellow">
          A draw is running — deposits &amp; withdrawals unlock in a few seconds.
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="Amount (cUSDC)"
          inputMode="decimal"
          className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-faint focus:border-purple"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={!ok || !!busy || frozen} onClick={() => run("deposit", () => p.deposit(toUnits(amt)))}>
          {busy === "deposit" ? "Encrypting…" : "Deposit"}
        </Button>
        <Button variant="ghost" disabled={!ok || !!busy || frozen} onClick={() => run("withdraw", () => p.withdraw(toUnits(amt)))}>
          {busy === "withdraw" ? "…" : "Withdraw"}
        </Button>
        <Button variant="yellow" disabled={!!busy} onClick={() => run("faucet", () => p.faucet(toUnits(String(FAUCET_TOKENS))))}>
          {busy === "faucet" ? "…" : `Faucet +${FAUCET_TOKENS.toLocaleString()}`}
        </Button>
        <Button variant="ghost" disabled={!!busy || frozen} onClick={() => run("exit", () => p.exit())}>
          {busy === "exit" ? "…" : "Withdraw all"}
        </Button>
      </div>
      {msg && <p className={`mt-3 text-[12px] ${msg.startsWith("✓") ? "text-mint" : "text-coral"}`}>{msg}</p>}
    </Panel>
  );
}

// ---------------------------------------------------------------- my numbers

function MyNumbersCard({ totalWeight }: { totalWeight: bigint }) {
  const p = usePool();
  const [vals, setVals] = useState<{ usdc?: bigint; tickets?: bigint; weight?: bigint }>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function reveal() {
    setBusy(true);
    setMsg("");
    try {
      const [usdc, tickets, weight] = await Promise.all([p.decryptUsdcBalance(), p.decryptTickets(), p.decryptMyWeight()]);
      setVals({ usdc, tickets, weight });
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const odds = useMemo(() => {
    if (vals.weight === undefined || totalWeight === 0n) return null;
    // rough between draws: compares my live weight to the LAST draw's total (the only public total)
    const pct = Number((vals.weight * 10000n) / (totalWeight > vals.weight ? totalWeight : vals.weight)) / 100;
    return Math.min(pct, 100);
  }, [vals.weight, totalWeight]);

  const Row = ({ label, v, unit }: { label: string; v?: bigint; unit: string }) => (
    <div className="flex items-center justify-between border-b border-divider py-2 last:border-0">
      <span className="text-[13px] text-dim">{label}</span>
      {v === undefined ? <Cipher /> : <span className="font-mono text-sm text-txt">{unit === "w" ? v.toString() : fmtUnits(v)} {unit === "w" ? "" : unit}</span>}
    </div>
  );

  return (
    <Panel>
      <Label>My numbers — only you can decrypt</Label>
      <Row label="Wallet cUSDC" v={vals.usdc} unit="cUSDC" />
      <Row label="Prize tickets" v={vals.tickets} unit="SPT" />
      <Row label="Draw weight (time-weighted)" v={vals.weight} unit="w" />
      <div className="flex items-center justify-between py-2">
        <span className="text-[13px] text-dim">Estimated odds</span>
        {odds === null ? <Cipher /> : <span className="font-mono text-sm text-mint">≈ {odds.toFixed(2)}%</span>}
      </div>
      <Button className="mt-2 w-full" disabled={busy} onClick={reveal}>
        {busy ? "Signing EIP-712…" : "Decrypt my numbers"}
      </Button>
      <p className="mt-2 text-[11px] text-faint">
        Decryption happens client-side via the Zama relayer after you sign an EIP-712 permission — the chain never learns the values.
      </p>
      {msg && <p className="mt-2 text-[12px] text-coral">{msg}</p>}
    </Panel>
  );
}

// ---------------------------------------------------------------- winnings

function WinningsCard({ onDone }: { onDone: () => void }) {
  const p = usePool();
  const [win, setWin] = useState<bigint | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel className="relative overflow-hidden">
      {win !== null && win > 0n && <Confetti />}
      <Label>Winnings — winner-blind</Label>
      <p className="mb-3 text-[13px] text-dim">
        Draws credit an encrypted amount to <span className="text-txt">every saver</span>: the winners get the prize, everyone else gets
        +0. Nobody — not even the pool — learns who won. Decrypt to find out if it&apos;s you.
      </p>
      <div className="grid h-16 place-items-center rounded-lg border border-line2 bg-panel2">
        {win === null ? (
          <Cipher className="text-lg" />
        ) : win > 0n ? (
          <span className="font-display text-2xl font-700 text-yellow">🏆 {fmtUnits(win)} cUSDC</span>
        ) : (
          <span className="font-mono text-sm text-muted">0.00 — not this time</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={!!busy} onClick={() => run("reveal", async () => setWin(await p.decryptWinnings()))}>
          {busy === "reveal" ? "Decrypting…" : "Reveal"}
        </Button>
        <Button
          variant="yellow"
          disabled={!!busy || win === null || win === 0n}
          onClick={() =>
            run("claim", async () => {
              await p.claim();
              setWin(null);
              setMsg("✓ claimed to your wallet");
              onDone();
            })
          }
        >
          {busy === "claim" ? "…" : "Claim"}
        </Button>
      </div>
      {msg && <p className={`mt-3 text-[12px] ${msg.startsWith("✓") ? "text-mint" : "text-coral"}`}>{msg}</p>}
    </Panel>
  );
}

// ---------------------------------------------------------------- draw panel

function DrawPanel({ st, due, onDone }: { st: PoolStatus | null; due: boolean; onDone: () => void }) {
  const p = usePool();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy("");
    }
  }

  const steps = [
    { n: 1, t: "Snapshot", d: "Freeze weights; publish ONE aggregate — the pool's total weight — for decryption." },
    { n: 2, t: "Seed", d: "Anyone relays the KMS decryption + proof; verified on-chain. FHE randomness picks encrypted thresholds." },
    { n: 3, t: "Select", d: "Walk savers in pages; first encrypted cumulative weight past each threshold wins that tier — identity never revealed." },
  ];
  const active = st ? st.drawState : -1;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label>Draw engine — permissionless crank</Label>
        <span className="font-mono text-[11px] text-muted">
          draw #{st?.drawId ?? "…"} · keeper runs automatically · any visitor can advance it
        </span>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={`rounded-lg border px-4 py-3 ${
              active === i + (active === 0 && i === 0 ? 0 : 0) && active !== 0 && i === active - 1
                ? "border-yellow/50 bg-yellow/5"
                : "border-line2 bg-panel2"
            }`}
          >
            <div className="font-mono text-[11px] text-muted">phase {s.n}</div>
            <div className="font-display text-sm font-600">{s.t}</div>
            <div className="mt-1 text-[12px] text-dim">{s.d}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {st?.drawState === 0 && (
          <Button disabled={!due || !!busy} onClick={() => run("start", () => p.startDraw())}>
            {busy === "start" ? "…" : due ? "Start draw now" : "Draw not due yet"}
          </Button>
        )}
        {st?.drawState === 1 && (
          <Button variant="yellow" disabled={!!busy} onClick={() => run("seed", () => p.relaySeed())}>
            {busy === "seed" ? "Fetching KMS proof…" : "Relay randomness seed"}
          </Button>
        )}
        {st?.drawState === 2 && (
          <Button variant="yellow" disabled={!!busy} onClick={() => run("page", () => p.drawPage())}>
            {busy === "page" ? "…" : `Advance selection (${st.drawCursor}/${st.participantCount})`}
          </Button>
        )}
        {ADDRESSES.yieldSource !== "0x0000000000000000000000000000000000000000" && (
          <Button variant="ghost" disabled={!!busy || !st || st.yieldAccrued === 0n} onClick={() => run("harvest", () => p.harvest())}>
            {busy === "harvest" ? "…" : `Harvest yield (+${st ? fmtUnits(st.yieldAccrued) : "0"} cUSDC)`}
          </Button>
        )}
        <SponsorInline onDone={onDone} />
      </div>
      {msg && <p className="mt-3 text-[12px] text-coral">{msg}</p>}
    </Panel>
  );
}

function SponsorInline({ onDone }: { onDone: () => void }) {
  const p = usePool();
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        placeholder="Sponsor prize (cUSDC)"
        inputMode="decimal"
        className="w-44 rounded-lg border border-line2 bg-panel2 px-3 py-2.5 font-mono text-[12px] outline-none placeholder:text-faint focus:border-purple"
      />
      <Button
        variant="ghost"
        disabled={!validAmount(amt) || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await p.sponsor(toUnits(amt));
            setAmt("");
            onDone();
          } catch {
            /* surfaced by input staying put */
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : "Sponsor 🔒"}
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------- history

function History({ rows }: { rows: DrawRow[] }) {
  return (
    <Panel>
      <Label>Draw history — verify every draw</Label>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">No draws yet — the first one runs when the countdown hits zero.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-4">Draw</th>
                <th className="py-2 pr-4">Result</th>
                <th className="py-2 pr-4">Total weight (public by design)</th>
                <th className="py-2 pr-4">Winners</th>
                <th className="py-2">Proof</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.drawId}`} className="border-t border-divider">
                  <td className="py-2.5 pr-4 font-mono">#{r.drawId}</td>
                  <td className="py-2.5 pr-4">
                    {r.kind === "completed" ? (
                      <span className="text-mint">prizes awarded</span>
                    ) : (
                      <span className="text-muted">rolled over (no weight)</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-dim">{r.kind === "completed" ? r.totalWeight.toString() : "0"}</td>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 text-purple">
                      <MsIcon name="lock" size={14} /> encrypted
                    </span>
                  </td>
                  <td className="py-2.5">
                    <a
                      className="font-mono text-[12px] text-dim underline decoration-line2 hover:text-txt"
                      href={`${ETHERSCAN}/tx/${r.tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- fairness

function Fairness() {
  return (
    <Panel>
      <Label>How the draw stays fair AND private</Label>
      <div className="grid gap-4 text-[13px] text-dim md:grid-cols-3">
        <div>
          <div className="mb-1 font-display font-600 text-txt">Provably weighted</div>
          Your chance is exactly your time-weighted balance ÷ pool total. Weights come from encrypted TWAB accounting, so
          depositing right before a draw earns almost nothing — no sniping.
        </div>
        <div>
          <div className="mb-1 font-display font-600 text-txt">On-chain randomness</div>
          Thresholds are drawn with <span className="font-mono">FHE.randEuint128()</span> — encrypted randomness generated by the
          coprocessor, bounded by a KMS-signature-verified total. No off-chain RNG, no oracle to bribe.
        </div>
        <div>
          <div className="mb-1 font-display font-600 text-txt">Winner-blind payout</div>
          Selection compares encrypted cumulative sums; prizes are credited via <span className="font-mono">FHE.select</span> to
          every saver (winner: prize, others: +0). Only your own decryption reveals whether you won.
        </div>
      </div>
      <p className="mt-4 border-t border-divider pt-3 font-mono text-[11px] text-faint">
        contracts:{" "}
        <a className="underline hover:text-txt" href={`${ETHERSCAN}/address/${ADDRESSES.pool}`} target="_blank" rel="noreferrer">
          pool
        </a>{" "}
        ·{" "}
        <a className="underline hover:text-txt" href={`${ETHERSCAN}/address/${ADDRESSES.cUSDC}`} target="_blank" rel="noreferrer">
          cUSDC
        </a>{" "}
        ·{" "}
        <a className="underline hover:text-txt" href={`${ETHERSCAN}/address/${ADDRESSES.yieldSource}`} target="_blank" rel="noreferrer">
          yield source
        </a>{" "}
        — all verified. What leaks: the per-draw pool total weight, saver count, tx timing. What never leaks: deposits, balances,
        individual odds, winners, prize splits, sponsor amounts.
      </p>
    </Panel>
  );
}
