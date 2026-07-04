"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MsIcon, Panel, Button, Label } from "@/components/ui";
import { CUSDC, OPERATOR_UNTIL, tokenAbi, factoryAddress, createCampaign, authorize, claim, type ClaimPayload } from "@/lib/tokenops";

const WINDOWS: [string, number][] = [
  ["1H", 3600],
  ["6H", 21600],
  ["1D", 86400],
];
const field = "w-full rounded-lg border border-line2 bg-panel2 px-3 py-2.5 text-sm text-txt outline-none focus:border-purple/60";

export default function Home() {
  const { address, isConnected } = useAccount();
  const pub = usePublicClient();
  const { data: wallet } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [poolAmt, setPoolAmt] = useState("1000");
  const [win, setWin] = useState(86400);
  const [airdrop, setAirdrop] = useState<`0x${string}` | "">("");
  const [recip, setRecip] = useState("");
  const [allocAmt, setAllocAmt] = useState("100");
  const [payload, setPayload] = useState("");
  const [claimInput, setClaimInput] = useState("");
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState("");

  const say = (m: string) => setLog((l) => `${new Date().toLocaleTimeString()}  ${m}\n${l}`);
  const run = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      say("ERR " + (e.shortMessage ?? e.message ?? String(e)));
    } finally {
      setBusy("");
    }
  };
  const waitTx = async (hash: `0x${string}`) => {
    await pub!.waitForTransactionReceipt({ hash });
  };

  const prep = run("prep", async () => {
    say("Minting 5000 cUSDC…");
    await waitTx(await writeContractAsync({ address: CUSDC, abi: tokenAbi, functionName: "mint", args: [5000n] }));
    const factory = factoryAddress(pub, wallet);
    const isOp = await pub!.readContract({ address: CUSDC, abi: tokenAbi, functionName: "isOperator", args: [address!, factory] });
    if (!isOp) {
      say("Authorizing the airdrop factory…");
      await waitTx(await writeContractAsync({ address: CUSDC, abi: tokenAbi, functionName: "setOperator", args: [factory, OPERATOR_UNTIL] }));
    }
    say("Ready. Create a campaign →");
  });

  const create = run("create", async () => {
    say(`Deploying + funding a campaign with an encrypted pool of ${poolAmt}…`);
    const { airdrop: a } = await createCampaign(pub, wallet, address!, Number(poolAmt), win);
    setAirdrop(a);
    say(`Campaign live: ${a}`);
  });

  const issue = run("issue", async () => {
    if (!airdrop) throw new Error("create a campaign first");
    if (recip.length !== 42) throw new Error("enter a recipient 0x address");
    say(`Encrypting ${allocAmt} for ${recip.slice(0, 8)}… + signing authorization`);
    const p = await authorize(pub, wallet, airdrop as `0x${string}`, recip as `0x${string}`, Number(allocAmt));
    setPayload(JSON.stringify(p));
    say("Claim authorization ready — send the payload below to the recipient.");
  });

  const doClaim = run("claim", async () => {
    const p = JSON.parse(claimInput) as ClaimPayload;
    say("Claiming your confidential allocation…");
    const hash = await claim(pub, wallet, p);
    await waitTx(hash);
    say(`Claimed. Tokens received (encrypted). tx ${hash.slice(0, 12)}…`);
  });

  return (
    <div className="min-h-screen bg-page text-txt">
      <header className="flex h-14 items-center justify-between border-b border-line bg-topbar px-4">
        <div className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-purple text-page">
            <MsIcon name="redeem" size={15} />
          </span>
          <span className="font-display text-lg font-700">Confidential Airdrop</span>
          <span className="rounded-full border border-yellow/30 px-2 py-0.5 font-mono text-[10px] text-yellow">TOKENOPS × ZAMA</span>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-700">Distribute tokens, allocations encrypted</h1>
        <p className="mt-1 text-sm text-muted">
          Admin funds an encrypted pool and signs a per-recipient allocation; the recipient claims and only they can read the
          amount. Built on the TokenOps SDK — <span className="font-mono text-dim">verified live</span> (see repo
          <span className="font-mono text-dim"> scripts/smoke.mjs</span>).
        </p>

        {!isConnected && (
          <Panel className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
            <MsIcon name="lock" size={28} className="text-purple" />
            <p className="text-sm text-muted">Connect a wallet on Sepolia to try it.</p>
            <ConnectButton />
          </Panel>
        )}

        {isConnected && (
          <div className="mt-6 grid gap-4">
            <Panel>
              <div className="font-mono text-[12px] text-dim">ADMIN · 01 · PREPARE</div>
              <p className="mt-1 text-sm text-muted">Mint demo cUSDC and authorize the airdrop factory to fund campaigns.</p>
              <Button className="mt-3" variant="ghost" disabled={!!busy} onClick={prep}>
                {busy === "prep" ? "Preparing…" : "Mint cUSDC + authorize"}
              </Button>
            </Panel>

            <Panel>
              <div className="font-mono text-[12px] text-dim">ADMIN · 02 · CREATE CAMPAIGN</div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <Label>Pool amount (encrypted)</Label>
                  <input className={`${field} w-36`} value={poolAmt} onChange={(e) => setPoolAmt(e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <Label>Claim window</Label>
                  <div className="inline-flex rounded-lg border border-line2 bg-panel2 p-0.5">
                    {WINDOWS.map(([l, v]) => (
                      <button
                        key={v}
                        onClick={() => setWin(v)}
                        className={`rounded-md px-3 py-1.5 text-[13px] font-600 ${win === v ? "bg-purple text-white" : "text-muted"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="primary" disabled={!!busy} onClick={create}>
                  {busy === "create" ? "Deploying…" : "Create + fund"}
                </Button>
              </div>
              {airdrop && <p className="mt-3 font-mono text-[12px] text-mint">campaign: {airdrop}</p>}
            </Panel>

            <Panel>
              <div className="font-mono text-[12px] text-dim">ADMIN · 03 · ISSUE A CLAIM</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input className={field} placeholder="recipient 0x…" value={recip} onChange={(e) => setRecip(e.target.value)} />
                <input className={field} placeholder="amount" value={allocAmt} onChange={(e) => setAllocAmt(e.target.value)} inputMode="numeric" />
                <Button variant="yellow" disabled={!!busy || !airdrop} onClick={issue}>
                  {busy === "issue" ? "Signing…" : "Encrypt + sign"}
                </Button>
              </div>
              {payload && (
                <div className="mt-3">
                  <Label>Claim payload — give this to the recipient</Label>
                  <textarea className={`${field} h-24 font-mono text-[11px]`} readOnly value={payload} onFocus={(e) => e.currentTarget.select()} />
                </div>
              )}
            </Panel>

            <Panel className="border-yellow/20">
              <div className="font-mono text-[12px] text-dim">RECIPIENT · CLAIM</div>
              <p className="mt-1 text-sm text-muted">Paste a claim payload and receive your confidential allocation.</p>
              <textarea
                className={`${field} mt-3 h-24 font-mono text-[11px]`}
                placeholder='{"airdrop":"0x…","handle":"0x…","inputProof":"0x…","signature":"0x…"}'
                value={claimInput}
                onChange={(e) => setClaimInput(e.target.value)}
              />
              <Button className="mt-3" variant="primary" disabled={!!busy || !claimInput} onClick={doClaim}>
                {busy === "claim" ? "Claiming…" : "Claim"}
              </Button>
            </Panel>

            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Log</div>
              <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-panel p-3 font-mono text-[12px] text-muted">
                {log || "—"}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
