const Ms = ({ n, s = 20, c = "" }: { n: string; s?: number; c?: string }) => (
  <span className={`ms ${c}`} style={{ fontSize: s }} aria-hidden>
    {n}
  </span>
);

const APPS = [
  {
    icon: "savings",
    name: "Samar Saving",
    track: "S4 Bounty",
    href: "https://samar-pool.vercel.app",
    tag: "Save & win",
    body: "Confidential PoolTogether: no-loss prize savings where deposits, odds and even the winners stay encrypted — draws run on-chain with FHE randomness, provably fair.",
  },
  {
    icon: "swap_horiz",
    name: "Samar OTC",
    track: "Builder",
    href: "https://samar-otc.vercel.app",
    tag: "Trade",
    body: "A confidential OTC desk / dark pool. Order size, price, and the maker's hidden reserve stay encrypted — trustless atomic settlement plus sealed-bid Vickrey auctions.",
  },
  {
    icon: "lock",
    name: "Wrapper Registry",
    track: "Bounty",
    href: "https://samar-wrapper.vercel.app",
    tag: "On-ramp",
    body: "The on-ramp for confidential tokens: every ERC-20 ↔ ERC-7984 wrapper on Sepolia. Wrap, unwrap, decrypt your balance, faucet the mocks.",
  },
  {
    icon: "redeem",
    name: "Confidential Airdrop",
    track: "TokenOps",
    href: "https://samar-airdrop.vercel.app",
    tag: "Distribute",
    body: "Encrypted token distribution on the TokenOps SDK. The pool and every recipient's allocation stay encrypted; only each recipient reads their share.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-page text-txt">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-700">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-purple text-page">
            <Ms n="visibility_off" s={17} />
          </span>
          Samar
        </div>
        <a href="https://github.com/PugarHuda/samar-confidential-otc" target="_blank" className="flex items-center gap-1.5 font-mono text-[12px] text-muted hover:text-txt">
          <Ms n="code" s={15} /> source
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-14 sm:py-20">
          <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-purple">Confidential finance · Zama fhEVM</div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-700 leading-[1.05] sm:text-6xl">
            On-chain finance where the numbers stay <span className="text-purple">encrypted</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-dim">
            Four apps, one idea. Save, trade, wrap, and distribute tokens on a public chain — while size, price, balances, and
            even lottery winners stay unreadable to bots, counterparties, and validators alike. Built on Zama fhEVM and ERC-7984.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {APPS.map((a) => (
              <a key={a.name} href={a.href} target="_blank" className="rounded-lg bg-purple px-4 py-2.5 font-display text-sm font-600 text-white hover:brightness-110">
                {a.name} →
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-6 md:grid-cols-2">
          {APPS.map((a) => (
            <a key={a.name} href={a.href} target="_blank" className="group rounded-panel border border-line bg-panel p-6 transition hover:border-purple/50">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-panel2 text-purple">
                  <Ms n={a.icon} s={24} />
                </span>
                <span className="rounded-full border border-line2 px-2.5 py-0.5 font-mono text-[10px] text-muted">{a.track}</span>
              </div>
              <div className="mt-4 font-mono text-[11px] uppercase tracking-wider text-faint">{a.tag}</div>
              <div className="font-display text-xl font-700">{a.name}</div>
              <p className="mt-2 text-sm text-muted">{a.body}</p>
              <div className="mt-4 flex items-center gap-1 font-mono text-[12px] text-purple opacity-0 transition group-hover:opacity-100">
                Open <Ms n="arrow_forward" s={13} />
              </div>
            </a>
          ))}
        </section>

        <section className="my-10 rounded-panel border border-line bg-panel2 p-8">
          <div className="font-mono text-[12px] uppercase tracking-wider text-purple">One composable stack</div>
          <h2 className="mt-2 font-display text-2xl font-700">Wrap → Trade → Save → Distribute — all confidential</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ["Wrapper", "Turn any ERC-20 into a confidential ERC-7984 balance."],
              ["Samar OTC", "Trade those confidential tokens privately, size & price hidden."],
              ["Samar Saving", "Save them in a no-loss prize pool — encrypted odds, winner-blind draws."],
              ["Airdrop", "Distribute them with encrypted, per-recipient allocations."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-lg border border-line bg-panel p-4">
                <div className="font-mono text-[11px] text-faint">0{i + 1}</div>
                <div className="font-display font-600">{t}</div>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-panel border border-mint/20 bg-panel p-8">
          <div className="flex items-center gap-2 font-mono text-[12px] text-mint">
            <Ms n="verified" s={16} /> VERIFIED LIVE ON SEPOLIA
          </div>
          <p className="mt-3 max-w-3xl text-dim">
            Every core FHE operation is proven on-chain with reproducible scripts: OTC settlement, sealed-bid Vickrey auctions,
            wrap, unwrap→finalize, encrypted airdrop claim, and user-decryption. Not slideware — real transactions on the real
            coprocessor.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[12px] text-faint">
          <span>Samar · built on Zama fhEVM · Sepolia</span>
          <a href="https://github.com/PugarHuda/samar-confidential-otc" target="_blank" className="text-muted hover:text-txt">
            github.com/PugarHuda/samar-confidential-otc
          </a>
        </div>
      </footer>
    </div>
  );
}
