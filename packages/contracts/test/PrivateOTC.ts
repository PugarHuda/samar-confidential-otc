import { fhevm, ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import type { Signer } from "ethers";

const UNTIL = 2_000_000_000; // operator approval expiry (uint48 seconds)
const EXPIRES = 2_000_000_000; // intent expiry, far future
const DIRECT = 0;
const RFQ = 1;

describe("PrivateOTC", function () {
  let maker: Signer, taker: Signer, other: Signer, fourth: Signer;
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
    [, maker, taker, other, fourth] = await ethers.getSigners();
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

    it("maker can decrypt their OWN escrowed sell amount without grantView (ACL comes from the token)", async () => {
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await createIntent(5, 9000);
      // no grantView — the maker's ACL on the escrowed handle is granted by the token's _update,
      // which is why createIntent no longer re-grants it. If that grant were missing this reverts.
      const sellH = await otc.getSellAmount(0);
      expect(await fhevm.userDecryptEuint(FhevmType.euint64, sellH, otcAddr, maker)).to.equal(5n);
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

    it("Vickrey with 3 bidders: winner pays the SECOND-highest price, not the third or their own", async () => {
      await eth.connect(maker).mint(6);
      await usdc.connect(taker).mint(10000); // highest → winner
      await usdc.connect(fourth).mint(9000); // second-highest → the clearing price
      await usdc.connect(other).mint(7000); // third → loser
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);
      await usdc.connect(fourth).setOperator(otcAddr, UNTIL);
      await usdc.connect(other).setOperator(otcAddr, UNTIL);

      await createIntent(6, 0, RFQ);
      await submitBid(taker, 10000);
      await submitBid(fourth, 9000);
      await submitBid(other, 7000);
      expect(await otc.getBidCount(0)).to.equal(3n);

      await otc.connect(maker).finalizeAuction(0);

      // winner (taker): 6 cETH, pays the 2nd price 9000, refunded 1000 → holds 1000 cUSDC
      expect(await bal(eth, ethAddr, taker)).to.equal(6n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(1000n);
      // fourth (2nd-highest, loser) + other (loser): fully refunded, no asset
      expect(await bal(usdc, usdcAddr, fourth)).to.equal(9000n);
      expect(await bal(eth, ethAddr, fourth)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, other)).to.equal(7000n);
      // maker: receives the second price (9000), gives up the asset
      expect(await bal(usdc, usdcAddr, maker)).to.equal(9000n);
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

    it("top tie: exactly ONE winner takes the asset, the other is fully refunded, maker collects the price once", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(8000); // ties at the top
      await usdc.connect(other).mint(8000); // ties at the top
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);
      await usdc.connect(other).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      await submitBid(taker, 8000); // first equal-to-highest → the unique winner
      await submitBid(other, 8000);
      await otc.connect(maker).finalizeAuction(0);

      // winner (taker, bid first): 5 cETH, pays price 8000, refund 0
      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(0n);
      // the other tied bidder gets NO asset and a FULL refund — not robbed
      expect(await bal(eth, ethAddr, other)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, other)).to.equal(8000n);
      // maker collects the clearing price exactly ONCE, gives up one asset
      expect(await bal(usdc, usdcAddr, maker)).to.equal(8000n);
      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
    });

    it("reserve floor: the top bid below the maker's reserve is a no-op — asset back, every bid refunded", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(8000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000, RFQ); // hidden reserve 9000
      await submitBid(taker, 8000); // below reserve → nobody wins
      await otc.connect(maker).finalizeAuction(0);

      expect(await bal(eth, ethAddr, maker)).to.equal(5n); // asset returned
      expect(await bal(usdc, usdcAddr, maker)).to.equal(0n);
      expect(await bal(eth, ethAddr, taker)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(8000n); // bid refunded in full
    });

    it("reserve floor: a lone bid above the reserve wins but pays the reserve, not zero", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 6000, RFQ); // reserve 6000
      await submitBid(taker, 10000); // sole bidder; second price is 0, floored to 6000
      await otc.connect(maker).finalizeAuction(0);

      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(4000n); // 10000 - reserve 6000
      expect(await bal(usdc, usdcAddr, maker)).to.equal(6000n); // reserve, not 0
      expect(await bal(eth, ethAddr, maker)).to.equal(0n);
    });

    it("allowedTaker locks an RFQ auction — only the named bidder may submit", async () => {
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).mint(10000);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ, takerAddr);
      await expect(submitBid(other, 9000)).to.be.revertedWith("locked");
      await submitBid(taker, 9000); // the allowed bidder gets through
      expect(await otc.getBidCount(0)).to.equal(1n);
    });

    it("Vickrey is order-independent: bids submitted low→high→mid still clear at the 2nd price", async () => {
      await eth.connect(maker).mint(6);
      await usdc.connect(other).mint(7000); // submitted first, lowest
      await usdc.connect(taker).mint(10000); // submitted second, highest → winner
      await usdc.connect(fourth).mint(9000); // submitted last, 2nd-highest → clearing price
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      for (const s of [other, taker, fourth]) await usdc.connect(s).setOperator(otcAddr, UNTIL);

      await createIntent(6, 0, RFQ);
      await submitBid(other, 7000);
      await submitBid(taker, 10000);
      await submitBid(fourth, 9000);
      await otc.connect(maker).finalizeAuction(0);

      expect(await bal(eth, ethAddr, taker)).to.equal(6n); // highest wins regardless of order
      expect(await bal(usdc, usdcAddr, taker)).to.equal(1000n); // pays 2nd price 9000, refunded 1000
      expect(await bal(usdc, usdcAddr, maker)).to.equal(9000n); // maker gets the 2nd price exactly once
      expect(await bal(usdc, usdcAddr, other)).to.equal(7000n); // losers fully refunded
      expect(await bal(usdc, usdcAddr, fourth)).to.equal(9000n);
    });
  });

  describe("Guards & boundaries", function () {
    it("Direct: an offer EXACTLY at the reserve settles (ge is inclusive)", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(9000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000);
      await accept(taker, 9000); // offer == reserve

      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, maker)).to.equal(9000n);
    });

    it("RFQ: a top bid EXACTLY at the reserve sells at the reserve", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(9000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000, RFQ);
      await submitBid(taker, 9000); // == reserve → sells, price floored to reserve
      await otc.connect(maker).finalizeAuction(0);

      expect(await bal(eth, ethAddr, taker)).to.equal(5n);
      expect(await bal(usdc, usdcAddr, taker)).to.equal(0n); // bid 9000 - price 9000
      expect(await bal(usdc, usdcAddr, maker)).to.equal(9000n);
    });

    it("cannot settle twice: a filled Direct intent rejects a second accept", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await usdc.connect(other).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);
      await usdc.connect(other).setOperator(otcAddr, UNTIL);

      await createIntent(5, 9000);
      await accept(taker, 10000);
      await expect(accept(other, 10000)).to.be.revertedWith("not open");
    });

    it("cannot finalize an RFQ auction twice", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      await submitBid(taker, 10000);
      await otc.connect(maker).finalizeAuction(0);
      await expect(otc.connect(maker).finalizeAuction(0)).to.be.revertedWith("not open");
    });

    it("cancelIntent is blocked once bids exist, and only the maker may cancel", async () => {
      await eth.connect(maker).mint(5);
      await usdc.connect(taker).mint(10000);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      await usdc.connect(taker).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      await expect(otc.connect(other).cancelIntent(0)).to.be.revertedWith("not maker");
      await submitBid(taker, 10000);
      await expect(otc.connect(maker).cancelIntent(0)).to.be.revertedWith("has bids");
    });

    it("MAX_BIDDERS caps the book at 5: the 6th bid reverts and 5 still finalize correctly", async () => {
      const signers = await ethers.getSigners();
      const bidders = signers.slice(2, 8); // six distinct non-maker addresses
      await eth.connect(maker).mint(5);
      await eth.connect(maker).setOperator(otcAddr, UNTIL);
      const amounts = [1000, 2000, 3000, 4000, 5000]; // 5th is highest → winner, 2nd price 4000
      for (let i = 0; i < 5; i++) {
        await usdc.connect(bidders[i]).mint(amounts[i]);
        await usdc.connect(bidders[i]).setOperator(otcAddr, UNTIL);
      }
      await usdc.connect(bidders[5]).mint(9000);
      await usdc.connect(bidders[5]).setOperator(otcAddr, UNTIL);

      await createIntent(5, 0, RFQ);
      for (let i = 0; i < 5; i++) await submitBid(bidders[i], amounts[i]);
      expect(await otc.getBidCount(0)).to.equal(5n);
      await expect(submitBid(bidders[5], 9000)).to.be.revertedWith("auction full");

      await otc.connect(maker).finalizeAuction(0);
      expect(await bal(eth, ethAddr, bidders[4])).to.equal(5n); // highest bid wins the asset
      expect(await bal(usdc, usdcAddr, bidders[4])).to.equal(1000n); // pays 2nd price 4000 of its 5000
      expect(await bal(usdc, usdcAddr, maker)).to.equal(4000n); // maker gets the 2nd price
    });
  });
});
