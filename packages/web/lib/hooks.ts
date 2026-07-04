"use client";

import { useAccount, usePublicClient, useWriteContract, useSignTypedData } from "wagmi";
import { zeroHash, zeroAddress, type Hex } from "viem";
import { ADDRESSES, OPERATOR_UNTIL } from "./config";
import { tokenAbi, otcAbi } from "./abi";
import { encryptValues, userDecrypt } from "./fhe";

export type IntentRow = {
  id: number;
  maker: `0x${string}`;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  mode: number;
  status: number;
  expiresAt: number;
  allowedTaker: `0x${string}`;
};

export function useSamar() {
  const { address } = useAccount();
  const pub = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const otc = ADDRESSES.privateOTC;

  async function send(params: any) {
    const hash = await writeContractAsync(params);
    await pub!.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function isOperator(token: `0x${string}`) {
    if (!address) return false;
    return pub!.readContract({ address: token, abi: tokenAbi, functionName: "isOperator", args: [address, otc] });
  }

  async function ensureOperator(token: `0x${string}`) {
    if (await isOperator(token)) return;
    await send({ address: token, abi: tokenAbi, functionName: "setOperator", args: [otc, OPERATOR_UNTIL] });
  }

  async function mint(token: `0x${string}`, amount: number) {
    await send({ address: token, abi: tokenAbi, functionName: "mint", args: [BigInt(amount)] });
  }

  async function createDirect(opts: {
    sellToken: `0x${string}`;
    buyToken: `0x${string}`;
    sell: number;
    minBuy: number;
    expiresAt: number;
    allowedTaker?: string;
  }) {
    await ensureOperator(opts.sellToken);
    const { handles, proof } = await encryptValues(otc, address!, [BigInt(opts.sell), BigInt(opts.minBuy)]);
    await send({
      address: otc,
      abi: otcAbi,
      functionName: "createIntent",
      args: [
        opts.sellToken,
        opts.buyToken,
        handles[0],
        handles[1],
        proof,
        0, // Direct
        BigInt(opts.expiresAt),
        (opts.allowedTaker && opts.allowedTaker.length === 42 ? opts.allowedTaker : zeroAddress) as `0x${string}`,
      ],
    });
  }

  async function createRFQ(opts: { sellToken: `0x${string}`; buyToken: `0x${string}`; sell: number; expiresAt: number }) {
    await ensureOperator(opts.sellToken);
    const { handles, proof } = await encryptValues(otc, address!, [BigInt(opts.sell), 0n]); // minBuy unused in RFQ
    await send({
      address: otc,
      abi: otcAbi,
      functionName: "createIntent",
      args: [opts.sellToken, opts.buyToken, handles[0], handles[1], proof, 1, BigInt(opts.expiresAt), zeroAddress],
    });
  }

  async function submitBid(id: number, buyToken: `0x${string}`, bid: number) {
    await ensureOperator(buyToken);
    const { handles, proof } = await encryptValues(otc, address!, [BigInt(bid)]);
    await send({ address: otc, abi: otcAbi, functionName: "submitBid", args: [BigInt(id), handles[0], proof] });
  }

  async function finalizeAuction(id: number) {
    await send({ address: otc, abi: otcAbi, functionName: "finalizeAuction", args: [BigInt(id)] });
  }

  async function bidCount(id: number): Promise<number> {
    return Number(await pub!.readContract({ address: otc, abi: otcAbi, functionName: "getBidCount", args: [BigInt(id)] }));
  }

  async function hasBid(id: number): Promise<boolean> {
    if (!address) return false;
    return (await pub!.readContract({ address: otc, abi: otcAbi, functionName: "hasBid", args: [BigInt(id), address] })) as boolean;
  }

  async function accept(id: number, buyToken: `0x${string}`, offer: number) {
    await ensureOperator(buyToken);
    const { handles, proof } = await encryptValues(otc, address!, [BigInt(offer)]);
    await send({ address: otc, abi: otcAbi, functionName: "acceptIntent", args: [BigInt(id), handles[0], proof] });
  }

  async function grantView(id: number, viewer: string) {
    await send({ address: otc, abi: otcAbi, functionName: "grantView", args: [BigInt(id), viewer as `0x${string}`] });
  }

  async function cancel(id: number) {
    await send({ address: otc, abi: otcAbi, functionName: "cancelIntent", args: [BigInt(id)] });
  }

  async function decryptHandle(handle: Hex, contractAddress: `0x${string}`) {
    return userDecrypt(handle, contractAddress, address!, signTypedDataAsync);
  }

  async function decryptBalance(token: `0x${string}`) {
    const h = (await pub!.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "confidentialBalanceOf",
      args: [address!],
    })) as Hex;
    if (h === zeroHash) return 0n;
    return decryptHandle(h, token);
  }

  async function loadIntents(): Promise<IntentRow[]> {
    const n = Number(await pub!.readContract({ address: otc, abi: otcAbi, functionName: "nextId" }));
    const rows = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        pub!
          .readContract({ address: otc, abi: otcAbi, functionName: "getIntent", args: [BigInt(i)] })
          .then((r: any) => ({
            id: i,
            maker: r.maker,
            sellToken: r.sellToken,
            buyToken: r.buyToken,
            mode: Number(r.mode),
            status: Number(r.status),
            expiresAt: Number(r.expiresAt),
            allowedTaker: r.allowedTaker,
          })),
      ),
    );
    return rows.reverse();
  }

  async function getAmountHandles(id: number): Promise<{ sell: Hex; minBuy: Hex }> {
    const sell = (await pub!.readContract({ address: otc, abi: otcAbi, functionName: "getSellAmount", args: [BigInt(id)] })) as Hex;
    const minBuy = (await pub!.readContract({ address: otc, abi: otcAbi, functionName: "getMinBuyAmount", args: [BigInt(id)] })) as Hex;
    return { sell, minBuy };
  }

  return {
    address,
    otc,
    isOperator,
    ensureOperator,
    mint,
    createDirect,
    createRFQ,
    submitBid,
    finalizeAuction,
    bidCount,
    hasBid,
    accept,
    grantView,
    cancel,
    decryptHandle,
    decryptBalance,
    loadIntents,
    getAmountHandles,
  };
}
