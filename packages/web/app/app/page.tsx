"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tokenByAddress, shortAddr, intentId } from "@/lib/config";
import { useSamar, type IntentRow } from "@/lib/hooks";
import { Gate } from "@/components/Gate";
import { Panel, MsIcon, StatusPill, ModePill, TokenChip, Cipher, Segmented } from "@/components/ui";

const PAGE = 10;

export default function ActiveIntents() {
  const s = useSamar();
  const [rows, setRows] = useState<IntentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<number | -1>(-1);
  const [status, setStatus] = useState<number | -1>(-1);
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(0);
  const now = Math.floor(Date.now() / 1000);

  async function load() {
    setLoading(true);
    try {
      setRows(await s.loadIntents());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.address]);

  const filtered = rows.filter(
    (r) =>
      (mode === -1 || r.mode === mode) &&
      (status === -1 || r.status === status) &&
      (!mineOnly || r.maker.toLowerCase() === s.address?.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  function action(r: IntentRow) {
    const mine = r.maker.toLowerCase() === s.address?.toLowerCase();
    if (mine) return "Manage";
    if (r.status === 0) return "Accept";
    return "View";
  }

  return (
    <Gate requireConnect={false}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-700">Active Intents</h1>
          <p className="font-mono text-[12px] text-muted">ASSET_PAIRS_VISIBLE | AMOUNTS_ENCRYPTED</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 font-mono text-[12px] text-muted hover:text-txt">
          <MsIcon name="refresh" size={16} /> refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v);
            setPage(0);
          }}
          options={[
            { label: "All", value: -1 },
            { label: "Direct", value: 0 },
            { label: "RFQ", value: 1 },
          ]}
        />
        <Segmented
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={[
            { label: "All", value: -1 },
            { label: "Open", value: 0 },
            { label: "Filled", value: 2 },
          ]}
        />
        <button
          onClick={() => {
            setMineOnly((m) => !m);
            setPage(0);
          }}
          className={`rounded-lg border px-3 py-1.5 text-[13px] font-600 ${mineOnly ? "border-purple/40 text-purple" : "border-line2 text-muted"}`}
        >
          Mine only
        </button>
        <span className="ml-auto font-mono text-[12px] text-faint">
          {filtered.length}/{rows.length}
        </span>
      </div>

      <Panel className="mt-4 overflow-x-auto p-0 app-scroll">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[110px_1.7fr_86px_128px_1fr_110px_92px] items-center gap-2 border-b border-line px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-faint">
            <div>Intent</div>
            <div>Sell → Buy</div>
            <div>Mode</div>
            <div>Maker</div>
            <div>Volume</div>
            <div>Status</div>
            <div>Action</div>
          </div>

          {loading && <div className="px-4 py-10 text-center font-mono text-[12px] text-muted">loading…</div>}
          {!loading && view.length === 0 && (
            <div className="px-4 py-10 text-center font-mono text-[12px] text-muted">no intents · create one →</div>
          )}

          {view.map((r) => {
            const sellT = tokenByAddress(r.sellToken);
            const buyT = tokenByAddress(r.buyToken);
            const expired = r.status === 0 && r.expiresAt < now;
            return (
              <div
                key={r.id}
                className="grid grid-cols-[110px_1.7fr_86px_128px_1fr_110px_92px] items-center gap-2 border-b border-divider px-4 py-3 text-sm last:border-0 hover:bg-panel2/50"
              >
                <div className="font-mono text-[12px] text-dim">{intentId(r.id)}</div>
                <div className="flex items-center gap-1.5">
                  <TokenChip token={sellT} symbol={r.sellToken} />
                  <MsIcon name="arrow_forward" size={14} className="text-faint" />
                  <TokenChip token={buyT} symbol={r.buyToken} />
                </div>
                <div>
                  <ModePill mode={r.mode} />
                </div>
                <div className="font-mono text-[12px] text-muted">{shortAddr(r.maker)}</div>
                <div className="flex items-center gap-1.5 text-muted">
                  <MsIcon name="lock" size={14} className="text-faint" />
                  <Cipher />
                </div>
                <div>{expired ? <StatusPill status={4} /> : <StatusPill status={r.status} />}</div>
                <div>
                  <Link href={`/app/intents/${r.id}`} className="rounded-md bg-panel2 px-3 py-1.5 font-mono text-[12px] text-purple hover:bg-purple/10">
                    {action(r)}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[12px] text-muted">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">
            ← Prev
          </button>
          <span>
            PAGE {page + 1} / {pages}
          </span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">
            Next →
          </button>
        </div>
      )}
    </Gate>
  );
}
