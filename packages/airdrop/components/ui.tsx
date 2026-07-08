export function MsIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`ms ${className}`} style={{ fontSize: size }} aria-hidden="true">
      {name}
    </span>
  );
}

export function Cipher({ className = "" }: { className?: string }) {
  return (
    <span className={`cipher font-mono ${className}`} aria-label="encrypted">
      0x7f4e2a91c8
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "yellow" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const v =
    variant === "primary"
      ? "bg-purple text-white hover:brightness-110"
      : variant === "yellow"
        ? "bg-yellow text-ink hover:brightness-105"
        : "border border-line2 text-txt hover:bg-panel2";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-2 font-display text-sm font-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}
