"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MsIcon } from "./ui";

const NAV = [
  { href: "/app", label: "Active Intents", icon: "grid_view" },
  { href: "/app/create", label: "Create Intent", icon: "swap_horiz" },
  { href: "/app/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { href: "/app/faucet", label: "Faucet", icon: "water_drop" },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              active ? "bg-panel text-txt" : "text-muted hover:bg-panel/60 hover:text-txt"
            }`}
          >
            <MsIcon name={n.icon} size={20} className={active ? "text-purple" : ""} />
            {n.label}
          </Link>
        );
      })}
      <Link
        href="/app/create/direct"
        onClick={onNavigate}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-purple px-3 py-2.5 font-display text-sm font-600 text-white hover:brightness-110"
      >
        <MsIcon name="add" size={18} /> New Intent
      </Link>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page text-txt">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-topbar px-4">
        <div className="flex items-center gap-3">
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            <MsIcon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-700">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-purple text-page">
              <MsIcon name="visibility_off" size={16} />
            </span>
            Samar
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full border border-mint/30 px-2.5 py-0.5 font-mono text-[11px] text-mint sm:flex">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-mint" />
            SEPOLIA
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden items-center gap-1 font-mono text-[12px] text-muted hover:text-txt lg:flex">
            <MsIcon name="arrow_back" size={14} /> back to site
          </Link>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </header>

      {/* mobile drawer */}
      {menuOpen && (
        <div className="border-b border-line bg-topbar px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 py-6">
        <aside className="sticky top-20 hidden h-fit w-[236px] shrink-0 flex-col gap-1 md:flex">
          <div className="mb-2 px-2 font-mono text-[11px] uppercase tracking-wider text-faint">Navigation</div>
          <NavLinks pathname={pathname} />
          <div className="mt-8 flex flex-col gap-1">
            <a href="https://docs.zama.org" target="_blank" className="flex items-center gap-2 px-3 py-2 font-mono text-[12px] text-faint hover:text-muted">
              <MsIcon name="description" size={16} /> Docs
            </a>
            <a
              href="https://github.com/PugarHuda/samar-confidential-otc"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 font-mono text-[12px] text-faint hover:text-muted"
            >
              <MsIcon name="code" size={16} /> Source
            </a>
          </div>
        </aside>

        <main className="min-w-0 flex-1 app-scroll">{children}</main>
      </div>
    </div>
  );
}
