"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isConfigured } from "@/lib/config";
import { MsIcon, Panel } from "./ui";

/** Wraps app pages: shows a config warning if addresses are unset, and a connect prompt if disconnected. */
export function Gate({ children, requireConnect = true }: { children: React.ReactNode; requireConnect?: boolean }) {
  const { isConnected } = useAccount();

  if (!isConfigured) {
    return (
      <Panel className="text-center">
        <MsIcon name="warning" size={28} className="text-yellow" />
        <p className="mt-2 font-display text-lg font-600">Contracts not configured</p>
        <p className="mt-1 text-sm text-muted">
          Deploy the contracts and set <span className="font-mono text-dim">NEXT_PUBLIC_*</span> env vars (see
          <span className="font-mono text-dim"> .env.example</span>).
        </p>
      </Panel>
    );
  }

  if (requireConnect && !isConnected) {
    return (
      <Panel className="flex flex-col items-center gap-4 py-12 text-center">
        <MsIcon name="lock" size={32} className="text-purple" />
        <div>
          <p className="font-display text-lg font-600">Connect your wallet</p>
          <p className="mt-1 text-sm text-muted">Sepolia testnet · needed to mint, create and settle.</p>
        </div>
        <ConnectButton />
      </Panel>
    );
  }

  return <>{children}</>;
}
