"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isConfigured, SEPOLIA_CHAIN_ID } from "@/lib/config";
import { MsIcon, Panel, Button } from "./ui";

/** Wraps app pages: config warning if unset, connect prompt if disconnected, network prompt if wrong chain. */
export function Gate({ children, requireConnect = true }: { children: React.ReactNode; requireConnect?: boolean }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

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
          <p className="mt-1 text-sm text-muted">Sepolia testnet · needed to save, draw and claim.</p>
        </div>
        <ConnectButton />
      </Panel>
    );
  }

  if (isConnected && chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <Panel className="flex flex-col items-center gap-4 py-12 text-center">
        <MsIcon name="lan" size={32} className="text-coral" />
        <div>
          <p className="font-display text-lg font-600">Wrong network</p>
          <p className="mt-1 text-sm text-muted">Samar runs on Sepolia. Switch to continue.</p>
        </div>
        <Button variant="primary" onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
          Switch to Sepolia
        </Button>
      </Panel>
    );
  }

  return <>{children}</>;
}
