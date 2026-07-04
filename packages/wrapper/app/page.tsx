"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract, useSignTypedData, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { zeroHash, formatUnits, type Hex } from "viem";
import { REGISTRY, SEPOLIA_CHAIN_ID, OPERATOR_UNTIL, registryAbi, wrapperAbi, erc20Abi, shortAddr, type Pair } from "@/lib/registry";
import { encryptValues, userDecrypt } from "@/lib/fhe";
import { MsIcon, Panel, Button, Cipher } from "@/components/ui";

type Meta = { cSymbol: string; underSymbol: string; dec: number; underBal: bigint; cBal?: string };

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const pub = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const [pairs, setPairs] = useState<Pair[]>([]);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);

  const say = (m: string) => setLog((l) => `${new Date().toLocaleTimeString()}  ${m}\n${l}`);
  const send = async (p: any) => {
    const hash = await writeContractAsync(p);
    await pub!.waitForTransactionReceipt({ hash });
  };

  async function loadPairs() {
    setLoading(true);
    try {
      const raw = (await pub!.readContract({ address: REGISTRY, abi: registryAbi, functionName: "getTokenConfidentialTokenPairs" })) as any[];
      const list: Pair[] = raw
        .map((p) => ({ token: p.tokenAddress, cToken: p.confidentialTokenAddress, isValid: p.isValid }))
        .filter((p) => p.isValid);
      setPairs(list);
      const m: Record<string, Meta> = {};
      await Promise.all(
        list.map(async (p) => {
          const [cSymbol, underSymbol, dec, underBal] = await Promise.all([
            pub!.readContract({ address: p.cToken, abi: wrapperAbi, functionName: "symbol" }).catch(() => "c???"),
            pub!.readContract({ address: p.token, abi: erc20Abi, functionName: "symbol" }).catch(() => "???"),
            pub!.readContract({ address: p.token, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
            address ? pub!.readContract({ address: p.token, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => 0n) : Promise.resolve(0n),
          ]);
          m[p.cToken] = { cSymbol: cSymbol as string, underSymbol: underSymbol as string, dec: Number(dec), underBal: underBal as bigint };
        }),
      );
      setMeta(m);
    } catch (e: any) {
      say("ERR load " + (e.shortMessage ?? e.message));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (pub) loadPairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub, address]);

  const run = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      say("ERR " + (e.shortMessage ?? e.message));
    } finally {
      setBusy("");
    }
  };

  const units = (p: Pair, whole: string) => BigInt(whole || "0") * 10n ** BigInt(meta[p.cToken]?.dec ?? 18);

  const faucet = (p: Pair) =>
    run(`mint-${p.cToken}`, async () => {
      say(`Minting 1000 ${meta[p.cToken]?.underSymbol}…`);
      await send({ address: p.token, abi: erc20Abi, functionName: "mint", args: [address!, units(p, "1000")] });
      say("Minted. Now Wrap it →");
      loadPairs();
    })();

  const wrap = (p: Pair) =>
    run(`wrap-${p.cToken}`, async () => {
      const a = units(p, amt[p.cToken] || "0");
      if (a === 0n) throw new Error("enter an amount");
      say(`Approving ${amt[p.cToken]} ${meta[p.cToken]?.underSymbol}…`);
      await send({ address: p.token, abi: erc20Abi, functionName: "approve", args: [p.cToken, a] });
      say("Wrapping into confidential…");
      await send({ address: p.cToken, abi: wrapperAbi, functionName: "wrap", args: [address!, a] });
      say(`Wrapped → ${meta[p.cToken]?.cSymbol} (encrypted). Decrypt to view.`);
      loadPairs();
    })();

  const decrypt = (p: Pair) =>
    run(`dec-${p.cToken}`, async () => {
      const h = (await pub!.readContract({ address: p.cToken, abi: wrapperAbi, functionName: "confidentialBalanceOf", args: [address!] })) as Hex;
      const v = h === zeroHash ? 0n : await userDecrypt(h, p.cToken, address!, signTypedDataAsync);
      setMeta((m) => ({ ...m, [p.cToken]: { ...m[p.cToken], cBal: v.toString() } }));
      say(`${meta[p.cToken]?.cSymbol} balance decrypted (only you can read it).`);
    })();

  const unwrap = (p: Pair) =>
    run(`unwrap-${p.cToken}`, async () => {
      const raw = amt[p.cToken] || "0";
      if (BigInt(raw) === 0n) throw new Error("enter a confidential amount (raw units) to unwrap");
      say("Encrypting unwrap amount…");
      const { handles, proof } = await encryptValues(p.cToken, address!, [BigInt(raw)]);
      say("Requesting unwrap (Gateway will finalize + return the ERC-20)…");
      await send({ address: p.cToken, abi: wrapperAbi, functionName: "unwrap", args: [address!, address!, handles[0], proof] });
      say("Unwrap requested. The underlying ERC-20 arrives once the Gateway finalizes.");
      loadPairs();
    })();

  const wrongNet = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  return (
    <div className="min-h-screen bg-page text-txt">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-topbar px-4">
        <div className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-purple text-page">
            <MsIcon name="lock" size={15} />
          </span>
          <span className="font-display text-lg font-700">Confidential Wrapper Registry</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-mint/30 px-2.5 py-0.5 font-mono text-[11px] text-mint sm:flex">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-mint" /> SEPOLIA
          </span>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-2xl font-700">Every ERC-20 ↔ ERC-7984 wrapper on Sepolia</h1>
        <p className="mt-1 text-sm text-muted">
          Read live from the official registry{" "}
          <a className="text-purple" href={`https://sepolia.etherscan.io/address/${REGISTRY}`} target="_blank">
            {shortAddr(REGISTRY)}
          </a>
          . Mint test tokens, wrap them into confidential balances, decrypt yours, unwrap back.
        </p>

        {wrongNet && (
          <Panel className="mt-6 flex items-center justify-between">
            <span className="text-coral">⚠ Wrong network — switch to Sepolia.</span>
            <Button onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>Switch</Button>
          </Panel>
        )}

        {loading && <p className="mt-8 font-mono text-[12px] text-muted">loading registry…</p>}

        <div className="mt-6 grid gap-4">
          {pairs.map((p) => {
            const m = meta[p.cToken];
            return (
              <Panel key={p.cToken}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-600">
                      {m?.underSymbol} <span className="text-muted">→</span> {m?.cSymbol}
                    </div>
                    <div className="font-mono text-[11px] text-faint">
                      erc20 {shortAddr(p.token)} · c-token {shortAddr(p.cToken)}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[12px]">
                    <div className="text-muted">
                      public: {m ? Number(formatUnits(m.underBal, m.dec)).toLocaleString() : "—"} {m?.underSymbol}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-muted">
                      confidential: {m?.cBal !== undefined ? <span className="text-txt">{m.cBal}</span> : <Cipher />}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    className="w-28 rounded-lg border border-line2 bg-panel2 px-3 py-2 text-sm outline-none focus:border-purple/60"
                    placeholder="amount"
                    value={amt[p.cToken] ?? ""}
                    onChange={(e) => setAmt((a) => ({ ...a, [p.cToken]: e.target.value }))}
                    inputMode="numeric"
                    disabled={!isConnected || wrongNet}
                  />
                  <Button variant="ghost" disabled={!!busy || !isConnected || wrongNet} onClick={() => faucet(p)}>
                    {busy === `mint-${p.cToken}` ? "Minting…" : "Faucet 1000"}
                  </Button>
                  <Button variant="primary" disabled={!!busy || !isConnected || wrongNet} onClick={() => wrap(p)}>
                    {busy === `wrap-${p.cToken}` ? "Wrapping…" : "Wrap →"}
                  </Button>
                  <Button variant="ghost" disabled={!!busy || !isConnected || wrongNet} onClick={() => unwrap(p)}>
                    {busy === `unwrap-${p.cToken}` ? "Unwrapping…" : "← Unwrap"}
                  </Button>
                  <Button variant="yellow" disabled={!!busy || !isConnected || wrongNet} onClick={() => decrypt(p)}>
                    {busy === `dec-${p.cToken}` ? "Decrypting…" : "Decrypt"}
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>

        {!loading && pairs.length === 0 && <p className="mt-8 font-mono text-[12px] text-muted">no valid pairs found in the registry.</p>}

        <div className="mt-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Log</div>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-panel p-3 font-mono text-[12px] text-muted">
            {log || "—"}
          </div>
        </div>
        <p className="mt-4 font-mono text-[10px] text-faint">
          Wrap amount is in whole tokens (scaled by the ERC-20&apos;s decimals). Unwrap takes a raw confidential amount (decrypt to
          see it). Unwrap is async — the Gateway finalizes and returns the ERC-20.
        </p>
      </main>
    </div>
  );
}
