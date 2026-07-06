"use client";

import Link from "next/link";
import { Panel, MsIcon } from "@/components/ui";

const CARDS = [
  {
    href: "/app/create/direct",
    tag: "Mode 01",
    title: "Direct OTC",
    icon: "bolt",
    live: true,
    rows: [
      ["Parties", "One maker · one taker"],
      ["Latency", "< 5s"],
      ["Privacy", "End-to-end"],
    ],
  },
  {
    href: "/app/create/rfq",
    tag: "Mode 02",
    title: "RFQ Mode",
    icon: "gavel",
    live: true,
    rows: [
      ["Parties", "N takers · Vickrey"],
      ["Pricing", "Vickrey (2nd price)"],
      ["Max bidders", "5"],
    ],
  },
];

export default function CreateChooser() {
  return (
    <div>
      <h1 className="font-display text-2xl font-700">Create intent</h1>
      <p className="mb-6 font-mono text-[12px] text-muted">CHOOSE_EXECUTION_MODE</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Panel className="h-full transition group-hover:border-purple/50">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-panel2 text-purple">
                  <MsIcon name={c.icon} size={22} />
                </span>
                {c.live ? (
                  <span className="rounded-full border border-mint/30 px-2 py-0.5 font-mono text-[10px] text-mint">LIVE</span>
                ) : (
                  <span className="rounded-full border border-yellow/30 px-2 py-0.5 font-mono text-[10px] text-yellow">SOON</span>
                )}
              </div>
              <div className="mt-4 font-mono text-[11px] text-muted">{c.tag}</div>
              <div className="font-display text-xl font-700">{c.title}</div>
              <dl className="mt-4 space-y-1.5">
                {c.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between font-mono text-[12px]">
                    <dt className="text-faint">{k}</dt>
                    <dd className="text-dim">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex items-center gap-1 font-mono text-[12px] text-purple">
                Continue <MsIcon name="arrow_forward" size={14} />
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      <Panel className="mt-4 border-purple/20 bg-panel2">
        <div className="flex items-start gap-3">
          <MsIcon name="shield_lock" size={20} className="text-purple" />
          <div>
            <div className="font-mono text-[12px] text-dim">STRATEGY_B_GUARANTEE</div>
            <p className="mt-1 text-sm text-muted">
              Settlement never reverts on a secret condition. An offer below your hidden reserve settles as a no-op and refunds
              both sides — so &quot;too low&quot; never leaks on-chain.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
