import { fhevm, ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import type { Signer } from "ethers";

const UNTIL = 2_000_000_000; // operator approval expiry (uint48 seconds)
const EXPIRES = 2_000_000_000; // intent expiry, far future
const DIRECT = 0;
const RFQ = 1;

describe("PrivateOTC", function () {
  let maker: Signer, taker: Signer, other: Signer;
  let makerAddr: string, takerAddr: string, otherAddr: string;
  let usdc: any, eth: any, otc: any;
  let usdcAddr: string, ethAddr: string, otcAddr: string;

  async function deploy() {
    const Token = await ethers.getContractFactory("SamarCToken");
    usdc = await Token.deploy("Confidential USDC", "cUSDC", "");
    eth = await Token.deploy("Confidential ETH", "cETH", "");
    const OTC = await ethers.getContractFactory("PrivateOTC");
    otc = await OTC.deploy();
    usdcAddr = await usdc.getAddress();
    ethAddr = await eth.getAddress();
    otcAddr = await otc.getAddress();
  }

  async function bal(token: any, tokenAddr: string, who: Signer): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(await who.getAddress());
    if (handle === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddr, who);
  }

  // Maker sells cETH, wants cUSDC. sell = cETH amount, minBuy = hidden cUSDC reserve.
  async function createIntent(sell: number, minBuy: number, mode = DIRECT, allowedTaker = ethers.ZeroAddress) {
    const input = fhevm.createEncryptedInput(otcAddr, makerAddr);
    input.add64(sell);
    input.add64(minBuy);
    const enc = await input.encrypt();
    await otc
      .connect(maker)
      .createIntent(ethAddr, usdcAddr, enc.handles[0], enc.handles[1], enc.inputProof, mode, EXPIRES, allowedTaker);
  }

  async function encOne(who: Signer, value: number) {
    const input = fhevm.createEncryptedInput(otcAddr, await who.getAddress());
    input.add64(value);
    return input.encrypt();
  }

  async function accept(who: Signer, offer: number) {
    const enc = await encOne(who, offer);
    await otc.connect(who).acceptIntent(0, enc.handles[0], enc.inputProof);
  }

  async function submitBid(who: Signer, bid: number) {
    const enc = await encOne(who, bid);
    await otc.connect(who).submitBid(0, enc.handles[0], enc.inputProof);
  }

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [, maker, taker, other] = await ethers.getSigners();
    makerAddr = await maker.getAddress();
    takerAddr = await taker.getAddress();
    otherAddr = await other.getAddress();
    await deploy();
  });

  describe("Direct mode", function () {
    it("settles when the offer clears the hidden reserve — both legs move, amounts stay encrypted", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000);
      expect(await bal(eth, ethAddr, maker)).to.equal(0n);

      await accept(taker, 10000);

      expect(await bal(usdc, usdcAddr, maker)).to.equal(10000n);
      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(0n);
      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
    });

    it("Strategy B: an offer below the hidden reserve is a no-op — both sides made whole, status Filled", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000);
      await accept(taker, 8000);

      expect(await bal(eth, ethAddr, maker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(10000n);
      expect(await bal(eth, ethAddr, taker)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, maker)).to.equal(0n);

      expect((await otc.getIntent(0)).status).to.equal(2);
    });

    it("counterparty can decrypt the hidden reserve only after grantView", async () => {
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await createIntent(5, 9000);

      await otc.connect(maker).grantView(0, takerAddr);
      const sellH = await otc.getSellAmount(0);
      const minBuyH = await otc.getMinBuyAmount(0);
      expect(await fhevm.userDecryptEuint(FhevmType.euint64, sellH, otcAddr, taker)).to.equal(5n);
      expect(await fhevm.userDecryptEuint(FhevmType.euint64, minBuyH, otcAddr, taker)).to.equal(9000n);
    });

    it("allowedTaker locks the intent to one counterparty", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(other).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(other).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000, DIRECT, takerAddr);
      await expect(accept(other, 10000)).to.be.revertedWith("locked");
    });

    it("maker can cancel an open intent and reclaim escrow", async () => {
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await createIntent(5, 9000);

      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
      await otc.connect(maker).cancelIntent(0);
      expect(await bal(eth, ethAddr, maker)).to.equal(5n);
    });
  });

  describe("RFQ mode (sealed-bid Vickrey)", function () {
    it("highest bidder wins the asset and pays the second-highest price; loser is refunded", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000); // will bid 10000 (winner)
      await usdc.connect(other).mint(8000); // will bid 8000 (loser / second price)
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);
      await usdc.connect(other).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      await submitBid(taker, 10000);
      await submitBid(other, 8000);
      expect(await otc.getBidCount(0)).to.equal(2n);

      await otc.connect(maker).finalizeAuction(0);

      // winner (taker): gets 5 cETH, pays second price 8000, refunded 2000 → holds 2000 cUSDC
      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(2000n);
      // loser (other): no asset, fully refunded → 8000 cUSDC
      expect(await bal(eth, ethAddr, other)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, other)).to.equal(8000n);
      // maker: receives the second price, gives up the asset
      expect(await bal(usdc, usdcAddr, maker)).to.equal(8000n);
      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
    });

    it("an RFQ auction with no bids returns escrow to the maker", async () => {
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await createIntent(5, 0, RFQ);

      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
      await otc.connect(maker).finalizeAuction(0);
      expect(await bal(eth, ethAddr, maker)).to.equal(5n);
    });

    it("rejects a second bid from the same address and non-maker finalize before expiry", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      await submitBid(taker, 6000);
      await expect(submitBid(taker, 7000)).to.be.revertedWith("already bid");
      await expect(otc.connect(other).finalizeAuction(0)).to.be.revertedWith("not maker / not expired");
    });
  });
});
