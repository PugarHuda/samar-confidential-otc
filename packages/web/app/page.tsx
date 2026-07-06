import Link from "next/link";
import { MsIcon, Cipher } from "@/components/ui";
import Mascot from "@/components/landing/Mascot";

// ── small local sticker atoms (landing-only, not worth exporting) ─────────────
// note: project has no numeric fontWeight config, so use named weight utilities.
function MonoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border-[2.5px] border-ink bg-cream px-3 py-1 font-mono text-[12px] font-medium text-ink">
      {children}
    </span>
  );
}

function TokenGlyph({ color, glyph }: { color: string; glyph: string }) {
  return (
    <span
      className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink text-[11px] font-bold text-cream"
      style={{ background: color }}
    >
      {glyph}
    </span>
  );
}

function LaunchButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/app"
      className={`inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-purple px-5 py-2.5 font-display font-semibold text-white shadow-sticker-sm transition hover:-translate-y-0.5 ${className}`}
    >
      Launch app <span aria-hidden>→</span>
    </Link>
  );
}

const MARQUEE =
  "NO FRONT-RUNNING · NO MARKET IMPACT · ZERO INFO LEAKAGE · ATOMIC SETTLEMENT · END-TO-END ENCRYPTED · EVEN VALIDATORS ARE BLIND · ";

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-cream font-body text-ink">
      {/* ───────────────────────── 1. NAV ───────────────────────── */}
      <header className="sticky top-0 z-50 border-b-[3px] border-ink bg-cream">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Mascot className="h-9 w-9" />
            <span className="font-display text-2xl font-bold tracking-tight">Samar</span>
            <MonoChip>OTC · FHE</MonoChip>
          </Link>
          <LaunchButton />
        </nav>
      </header>

      {/* ───────────────────────── 2. HERO ───────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border-[2.5px] border-ink bg-yellow px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wide">
            <MsIcon name="lock" size={14} /> PRIVATE OTC DESK · POWERED BY ZAMA fhEVM
          </span>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Trade big. <span className="text-purple">Nobody</span> peeks.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/80">
            Samar is a confidential OTC desk. Post a large trade and the size, the price,
            everything stays fully encrypted on-chain. Counterparties settle atomically
            without ever seeing a plaintext number.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LaunchButton />
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-white px-5 py-2.5 font-display font-semibold text-ink shadow-sticker-sm transition hover:-translate-y-0.5"
            >
              How it works
            </a>
          </div>
        </div>

        {/* intent ticket sticker */}
        <div className="relative">
          <Mascot className="absolute -right-3 -top-10 z-20 h-24 w-24 animate-float drop-shadow-md" />
          <div className="relative rotate-3 rounded-sticker border-[3px] border-ink bg-white p-6 shadow-sticker">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium text-ink/70">INTENT #IX_0043</span>
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-mint px-2.5 py-0.5 font-mono text-[11px] font-bold">
                OPEN
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <TicketRow label="MAKER SELLS" color="#3E7BFA" glyph="$" symbol="cUSDC" />
              <TicketRow label="MAKER WANTS" color="#8B7FF0" glyph="Ξ" symbol="cETH" />
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t-[2.5px] border-dashed border-ink/30 pt-4 font-mono text-[11px] text-ink/60">
              <MsIcon name="lock" size={13} /> reserve hidden · counterparty-scoped view
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 3. MARQUEE ───────────────────────── */}
      <div className="overflow-hidden border-y-[3px] border-ink bg-ink py-3">
        <div className="flex w-max animate-marquee whitespace-nowrap">
          <span className="font-mono text-sm font-medium tracking-wide text-yellow">{MARQUEE.repeat(1)}</span>
          <span className="font-mono text-sm font-medium tracking-wide text-yellow" aria-hidden>
            {MARQUEE.repeat(1)}
          </span>
        </div>
      </div>

      {/* ───────────────────────── 4. PROBLEM ───────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Why whales avoid public DEXs
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <ProblemCard
            bg="bg-coral"
            icon="bolt"
            title="Front-running / MEV"
            body="Your order sits in the mempool in plaintext. Bots see it, jump the queue, and sell it back to you at a worse price."
          />
          <ProblemCard
            bg="bg-yellow"
            icon="trending_down"
            title="Market impact"
            body="A visible size moves the book against you the moment it lands. Everyone prices in your exit before you finish it."
          />
          <ProblemCard
            bg="bg-purple"
            textLight
            icon="visibility"
            title="Info leakage"
            body="Every wallet, every counterparty, every amount is public forever. Your whole strategy is readable by anyone with an explorer."
          />
        </div>
      </section>

      {/* ───────────────────────── 5. HOW IT WORKS ───────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Four steps, zero plaintext
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StepCard
            n="01"
            title="Create intent"
            body="Encrypt your sell size and ask locally, then post the ciphertext on-chain."
            note="FHE.fromExternal"
          />
          <StepCard
            n="02"
            title="Grant access"
            body="Scope a decryption grant to the exact counterparty. Nobody else can peek."
            note="FHE.allow"
          />
          <StepCard
            n="03"
            title="Fill or bid"
            body="A taker matches your terms — Direct fill now, sealed bids later."
            note="matchIntent"
          />
          <StepCard
            n="04"
            dark
            title="Atomic settle"
            body="Both encrypted legs swap in one transaction, or nothing moves at all."
            note="settle · Strategy-B"
          />
        </div>
      </section>

      {/* ───────────────────────── 6. FHE PUNCHLINE ───────────────────────── */}
      <section className="border-y-[3px] border-ink bg-page py-20 text-txt">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-cream md:text-5xl">
            This is what the world sees.
          </h2>
          <div className="mx-auto mt-10 max-w-2xl rounded-sticker border border-line bg-panel p-1 text-left shadow-sticker">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 font-mono text-[11px] text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-coral" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint" />
              <span className="ml-2">sepolia.etherscan.io · tx · Logs</span>
            </div>
            <div className="space-y-3 p-5 font-mono text-sm">
              <ExplorerRow label="sellAmount" />
              <ExplorerRow label="buyAmount" />
              <div className="pt-1 text-[13px] text-muted">
                🔒 unreadable — even by validators
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DarkChip>FHE.fromExternal</DarkChip>
            <DarkChip>FHE.allow (ACL)</DarkChip>
            <DarkChip>ERC-7984</DarkChip>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 7. ROADMAP ───────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">An honest scope</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-sticker border-[3px] border-ink bg-mint p-7 shadow-sticker">
            <h3 className="font-display text-2xl font-bold">✅ Live now</h3>
            <p className="mt-1 font-mono text-[12px] font-medium uppercase tracking-wide text-ink/60">
              Direct OTC + RFQ
            </p>
            <ul className="mt-4 space-y-2.5 text-ink/90">
              <RoadmapItem>Encrypted intents (size + price stay ciphertext)</RoadmapItem>
              <RoadmapItem>Hidden reserve amount</RoadmapItem>
              <RoadmapItem>Counterparty-scoped view grants</RoadmapItem>
              <RoadmapItem>Atomic Strategy-B settlement</RoadmapItem>
              <RoadmapItem>Sealed-bid Vickrey auctions (up to 10 bidders)</RoadmapItem>
              <RoadmapItem>Cancel an open intent anytime</RoadmapItem>
            </ul>
          </div>
          <div className="rounded-sticker border-[3px] border-ink bg-white p-7 shadow-sticker">
            <h3 className="font-display text-2xl font-bold">🗺 Coming soon</h3>
            <p className="mt-1 font-mono text-[12px] font-medium uppercase tracking-wide text-ink/50">
              Scaling up
            </p>
            <ul className="mt-4 space-y-2.5 text-ink/80">
              <RoadmapItem dim>Partial fills</RoadmapItem>
              <RoadmapItem dim>Compliance-gated fills (allowlist / KYC)</RoadmapItem>
              <RoadmapItem dim>More token pairs</RoadmapItem>
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 8. FOOTER CTA ───────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-sticker border-[3px] border-ink bg-purple p-10 text-center shadow-sticker md:p-14">
          <h2 className="mx-auto max-w-xl font-display text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Trade without leaving a number trail?
          </h2>
          <div className="mt-8 flex justify-center">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-yellow px-6 py-3 font-display text-lg font-semibold text-ink shadow-sticker-sm transition hover:-translate-y-0.5"
            >
              Launch app <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-6 font-mono text-[12px] text-white/70">
            Samar · built on Zama fhEVM · Sepolia testnet
          </p>
        </div>
      </section>
    </div>
  );
}

// ── section sub-components (kept in-file; landing-only) ───────────────────────
function TicketRow({ label, color, glyph, symbol }: { label: string; color: string; glyph: string; symbol: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-ink bg-cream px-4 py-3">
      <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/70">{label}</span>
      <span className="flex items-center gap-2">
        <Cipher className="text-sm" />
        <TokenGlyph color={color} glyph={glyph} />
        <span className="font-mono text-[12px] font-medium">{symbol}</span>
        <MsIcon name="lock" size={15} className="text-purple" />
      </span>
    </div>
  );
}

function ProblemCard({
  bg,
  icon,
  title,
  body,
  textLight,
}: {
  bg: string;
  icon: string;
  title: string;
  body: string;
  textLight?: boolean;
}) {
  const t = textLight ? "text-white" : "text-ink";
  return (
    <div className={`rounded-sticker border-[3px] border-ink ${bg} p-6 shadow-sticker ${t}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink bg-cream text-ink">
        <MsIcon name={icon} size={24} />
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
      <p className={`mt-2 text-[15px] leading-relaxed ${textLight ? "text-white/85" : "text-ink/80"}`}>{body}</p>
    </div>
  );
}

function StepCard({
  n,
  title,
  body,
  note,
  dark,
}: {
  n: string;
  title: string;
  body: string;
  note: string;
  dark?: boolean;
}) {
  if (dark) {
    return (
      <div className="rounded-sticker border-[3px] border-ink bg-page p-6 text-txt shadow-sticker">
        <span className="font-display text-3xl font-bold text-purple">{n}</span>
        <h3 className="mt-2 font-display text-xl font-bold text-cream">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-dim">{body}</p>
        <span className="mt-4 inline-block rounded-full border border-line bg-panel px-3 py-1 font-mono text-[12px] text-filled">
          {note}
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-sticker border-[3px] border-ink bg-white p-6 shadow-sticker">
      <span className="font-display text-3xl font-bold text-purple">{n}</span>
      <h3 className="mt-2 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/80">{body}</p>
      <span className="mt-4 inline-block rounded-full border-[2.5px] border-ink bg-cream px-3 py-1 font-mono text-[12px] font-medium">
        {note}
      </span>
    </div>
  );
}

function ExplorerRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <Cipher className="text-dim" />
      <span className="truncate text-faint">…a1b2c3d4e5f6</span>
    </div>
  );
}

function DarkChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-panel px-3.5 py-1.5 font-mono text-[12px] text-filled">
      {children}
    </span>
  );
}

function RoadmapItem({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <MsIcon name={dim ? "schedule" : "check_circle"} size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
