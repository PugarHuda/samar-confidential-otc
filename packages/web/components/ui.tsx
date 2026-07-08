import Link from "next/link";
import { STATUS, MODE, type TokenMeta } from "@/lib/config";

export function MsIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`ms ${className}`} style={{ fontSize: size }} aria-hidden="true">
      {name}
    </span>
  );
}

/** Blurred placeholder that reads as unreadable ciphertext. Deterministic (no hydration mismatch). */
export function Cipher({ className = "" }: { className?: string }) {
  return (
    <span className={`cipher font-mono ${className}`} aria-label="encrypted">
      0x7f4e2a91c8
    </span>
  );
}

const STATUS_CLS: Record<number, string> = {
  0: "text-mint border-mint/30",
  1: "text-yellow border-yellow/30",
  2: "text-filled border-filled/30",
  3: "text-muted border-line2",
  4: "text-coral border-coral/30",
};

export function StatusPill({ status }: { status: number }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono ${STATUS_CLS[status] ?? STATUS_CLS[3]}`}>
      {STATUS[status] ?? "—"}
    </span>
  );
}

export function ModePill({ mode }: { mode: number }) {
  const rfq = mode === 1;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono ${
        rfq ? "text-yellow border-yellow/40" : "text-purple border-purple/40"
      }`}
    >
      {MODE[mode] ?? "—"}
    </span>
  );
}

export function TokenChip({ token, symbol }: { token?: TokenMeta; symbol?: string }) {
  const color = token?.color ?? "#8B879C";
  const glyph = token?.glyph ?? "?";
  const label = token?.symbol ?? symbol ?? "?";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line2 bg-panel2 px-2 py-1 text-[13px]">
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-page"
        style={{ background: color }}
      >
        {glyph}
      </span>
      {label}
    </span>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-panel border border-line bg-panel p-5 ${className}`}>{children}</div>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "yellow" | "ghost";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const v =
    variant === "primary"
      ? "bg-purple text-white hover:brightness-110"
      : variant === "yellow"
        ? "bg-yellow text-ink hover:brightness-105"
        : "border border-line2 text-txt hover:bg-panel2";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2.5 font-display text-sm font-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const v = variant === "primary" ? "bg-purple text-white hover:brightness-110" : "border border-line2 text-txt hover:bg-panel2";
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-display text-sm font-600 transition ${v}`}>
      {children}
    </Link>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line2 bg-panel2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-600 transition ${
            value === o.value ? "bg-purple text-white" : "text-muted hover:text-txt"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
