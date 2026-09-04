"use client";

import { useAccount, usePublicClient, useWriteContract, useSignTypedData } from "wagmi";
import { zeroHash, type Hex } from "viem";
import { ADDRESSES, OPERATOR_UNTIL } from "./config";
import { tokenAbi, poolAbi, yieldAbi } from "./abi";
import { encryptValues, userDecrypt, publicDecryptWithProof } from "./fhe";

export type PoolStatus = {
  drawState: number;
  drawId: number;
  nextDrawAt: number;
  drawCursor: number;
  participantCount: number;
  lastDrawTotalWeight: bigint;
  drawPeriod: number;
  snapshotTs: number;
  yieldAccrued: bigint;
  yieldAprBps: number;
};

export type DrawRow = {
  drawId: number;
  kind: "completed" | "cancelled";
  totalWeight: bigint;
  tx: Hex;
  block: bigint;
};

export function usePool() {
  const { address } = useAccount();
  const pub = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const pool = ADDRESSES.pool;
  const usdc = ADDRESSES.cUSDC;

  async function send(params: any) {
    const hash = await writeContractAsync(params);
    await pub!.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function ensureOperator() {
    const ok = await pub!.readContract({ address: usdc, abi: tokenAbi, functionName: "isOperator", args: [address!, pool] });
    if (!ok) await send({ address: usdc, abi: tokenAbi, functionName: "setOperator", args: [pool, OPERATOR_UNTIL] });
  }

  async function faucet(units: bigint) {
    await send({ address: usdc, abi: tokenAbi, functionName: "mint", args: [units] });
  }

  async function deposit(units: bigint) {
    await ensureOperator();
    const { handles, proof } = await encryptValues(pool, address!, [units]);
    await send({ address: pool, abi: poolAbi, functionName: "deposit", args: [handles[0], proof] });
  }

  async function withdraw(units: bigint) {
    const { handles, proof } = await encryptValues(pool, address!, [units]);
    await send({ address: pool, abi: poolAbi, functionName: "withdraw", args: [handles[0], proof] });
  }

  async function exit() {
    await send({ address: pool, abi: poolAbi, functionName: "exit", args: [] });
  }

  async function claim() {
    await send({ address: pool, abi: poolAbi, functionName: "claim", args: [] });
  }

  async function sponsor(units: bigint) {
    await ensureOperator();
    const { handles, proof } = await encryptValues(pool, address!, [units]);
    await send({ address: pool, abi: poolAbi, functionName: "sponsorPrize", args: [handles[0], proof] });
  }

  // ---- draw crank (permissionless — any visitor can advance a stuck draw) ----

  async function startDraw() {
    await send({ address: pool, abi: poolAbi, functionName: "startDraw", args: [] });
  }

  /** Fetch the KMS public decryption of the snapshot weight and relay it (proof-verified on-chain). */
  async function relaySeed() {
    const handle = (await pub!.readContract({ address: pool, abi: poolAbi, functionName: "snapshotWeightHandle" })) as Hex;
    const { abiEncodedClearValues, decryptionProof } = await publicDecryptWithProof(handle);
    await send({ address: pool, abi: poolAbi, functionName: "seedDraw", args: [abiEncodedClearValues, decryptionProof] });
  }

  async function drawPage() {
    await send({ address: pool, abi: poolAbi, functionName: "drawPage", args: [0n] });
  }

  async function harvest() {
    await send({ address: ADDRESSES.yieldSource, abi: yieldAbi, functionName: "harvest", args: [] });
  }

  // ---- reads ----

  async function status(): Promise<PoolStatus> {
    const read = (functionName: any, args: any = []) =>
      pub!.readContract({ address: pool, abi: poolAbi, functionName, args } as any);
    const hasYield = ADDRESSES.yieldSource !== "0x0000000000000000000000000000000000000000";
    const [ds, id, next, cursor, parts, lastW, period, snapTs, accrued, apr] = await Promise.all([
      read("drawState"),
      read("drawId"),
      read("nextDrawAt"),
      read("drawCursor"),
      read("participantCount"),
      read("lastDrawTotalWeight"),
      read("drawPeriod"),
      read("snapshotTs"),
      hasYield ? pub!.readContract({ address: ADDRESSES.yieldSource, abi: yieldAbi, functionName: "accrued" }) : 0n,
      hasYield ? pub!.readContract({ address: ADDRESSES.yieldSource, abi: yieldAbi, functionName: "aprBps" }) : 0,
    ]);
    return {
      drawState: Number(ds),
      drawId: Number(id),
      nextDrawAt: Number(next),
      drawCursor: Number(cursor),
      participantCount: Number(parts),
      lastDrawTotalWeight: lastW as bigint,
      drawPeriod: Number(period),
      snapshotTs: Number(snapTs),
      yieldAccrued: accrued as bigint,
      yieldAprBps: Number(apr),
    };
  }

  async function decryptHandle(handle: Hex, contractAddress: `0x${string}`) {
    if (handle === zeroHash) return 0n;
    return userDecrypt(handle, contractAddress, address!, signTypedDataAsync);
  }

  async function readHandle(functionName: "confidentialBalanceOf" | "winningsOf" | "twabOf" | "twabCheckpointOf"): Promise<Hex> {
    return (await pub!.readContract({ address: pool, abi: poolAbi, functionName, args: [address!] })) as Hex;
  }

  async function decryptUsdcBalance() {
    const h = (await pub!.readContract({ address: usdc, abi: tokenAbi, functionName: "confidentialBalanceOf", args: [address!] })) as Hex;
    return decryptHandle(h, usdc);
  }

  async function decryptTickets() {
    return decryptHandle(await readHandle("confidentialBalanceOf"), pool);
  }

  async function decryptWinnings() {
    return decryptHandle(await readHandle("winningsOf"), pool);
  }

  /** Caller's CURRENT draw weight (twab-since-checkpoint + live accrual), all from own-decryptable handles. */
  async function decryptMyWeight(): Promise<bigint> {
    const [twabH, cpH, last, balH] = await Promise.all([
      readHandle("twabOf"),
      readHandle("twabCheckpointOf"),
      pub!.readContract({ address: pool, abi: poolAbi, functionName: "twabLastOf", args: [address!] }),
      readHandle("confidentialBalanceOf"),
    ]);
    const twab = twabH === zeroHash ? 0n : await decryptHandle(twabH, pool);
    const cp = cpH === zeroHash ? 0n : await decryptHandle(cpH, pool);
    const bal = balH === zeroHash ? 0n : await decryptHandle(balH, pool);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const live = last === 0n ? 0n : bal * (now - BigInt(last as bigint));
    const w = twab + live - cp;
    return w > 0n ? w : 0n;
  }

  async function history(): Promise<DrawRow[]> {
    const [completed, cancelled] = await Promise.all([
      pub!.getContractEvents({ address: pool, abi: poolAbi, eventName: "DrawCompleted", fromBlock: "earliest" }),
      pub!.getContractEvents({ address: pool, abi: poolAbi, eventName: "DrawCancelled", fromBlock: "earliest" }),
    ]);
    const rows: DrawRow[] = [
      ...completed.map((l: any) => ({
        drawId: Number(l.args.drawId),
        kind: "completed" as const,
        totalWeight: l.args.totalWeight as bigint,
        tx: l.transactionHash as Hex,
        block: l.blockNumber as bigint,
      })),
      ...cancelled.map((l: any) => ({
        drawId: Number(l.args.drawId),
        kind: "cancelled" as const,
        totalWeight: 0n,
        tx: l.transactionHash as Hex,
        block: l.blockNumber as bigint,
      })),
    ];
    return rows.sort((a, b) => b.drawId - a.drawId);
  }

  return {
    address,
    pool,
    faucet,
    deposit,
    withdraw,
    exit,
    claim,
    sponsor,
    startDraw,
    relaySeed,
    drawPage,
    harvest,
    status,
    history,
    decryptUsdcBalance,
    decryptTickets,
    decryptWinnings,
    decryptMyWeight,
  };
}
