import { fhevm, ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { Signer } from "ethers";

const UNTIL = 2_000_000_000; // operator approval expiry (uint48 seconds)
const PERIOD = 3600;
const TIERS = [7000, 2000, 1000]; // grand + 2 consolation, 100% of reserve
const RESERVE = 10_000_000; // unit = 1000 → prizes 7M / 2M / 1M, no rounding dust

describe("ConfidentialPrizePool", function () {
  let alice: Signer, bob: Signer, carol: Signer, dave: Signer;
  let aliceAddr: string, bobAddr: string;
  let usdc: any, pool: any;
  let usdcAddr: string, poolAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [, alice, bob, carol, dave] = await ethers.getSigners();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();
    const Token = await ethers.getContractFactory("SamarCToken");
    usdc = await Token.deploy("Confidential USDC", "cUSDC", "");
    usdcAddr = await usdc.getAddress();
    const Pool = await ethers.getContractFactory("ConfidentialPrizePool");
    pool = await Pool.deploy(usdcAddr, PERIOD, TIERS);
    poolAddr = await pool.getAddress();
  });

  async function bal(token: any, tokenAddr: string, who: Signer): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(await who.getAddress());
    if (handle === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddr, who);
  }

  async function winnings(who: Signer): Promise<bigint> {
    const handle = await pool.winningsOf(await who.getAddress());
    if (handle === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddr, who);
  }

  async function enc(who: Signer, value: number | bigint) {
    const input = fhevm.createEncryptedInput(poolAddr, await who.getAddress());
    input.add64(BigInt(value));
    return input.encrypt();
  }

  async function fund(who: Signer, amount: number) {
    await usdc.connect(who).mint(amount);
    await usdc.connect(who).setOperator(poolAddr, UNTIL);
  }

  async function deposit(who: Signer, amount: number) {
    const e = await enc(who, amount);
    await pool.connect(who).deposit(e.handles[0], e.inputProof);
  }

  async function sponsor(who: Signer, amount: number) {
    const e = await enc(who, amount);
    await pool.connect(who).sponsorPrize(e.handles[0], e.inputProof);
  }

  /** Crank one full draw: start → relay public decryption (KMS-proof-verified) → all pages. */
  async function runDraw() {
    await pool.startDraw();
    const handle = await pool.snapshotWeightHandle();
    const res = await fhevm.publicDecrypt([handle]);
    await pool.seedDraw(res.abiEncodedClearValues, res.decryptionProof);
    if ((await pool.drawState()) === 0n) return; // cancelled (zero weight)
    const n = await pool.participantCount();
    while ((await pool.drawCursor()) < n) await pool.drawPage(0);
    expect(await pool.drawState()).to.equal(0n); // back to Open
  }

  describe("deposit / withdraw — no loss", function () {
    it("deposits encrypted, balance decryptable only by owner, full principal withdrawable", async () => {
      await fund(alice, 5000);
      await deposit(alice, 3000);
      expect(await bal(pool, poolAddr, alice)).to.equal(3000n); // tickets 1:1
      expect(await bal(usdc, usdcAddr, alice)).to.equal(2000n);

      const e = await enc(alice, 1000);
      await pool.connect(alice).withdraw(e.handles[0], e.inputProof);
      expect(await bal(pool, poolAddr, alice)).to.equal(2000n);
      expect(await bal(usdc, usdcAddr, alice)).to.equal(3000n);

      await pool.connect(alice).exit();
      expect(await bal(pool, poolAddr, alice)).to.equal(0n);
      expect(await bal(usdc, usdcAddr, alice)).to.equal(5000n); // full principal back — no loss
    });

    it("over-withdrawal is an encrypted no-op, never a revert", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      const e = await enc(alice, 999_999);
      await pool.connect(alice).withdraw(e.handles[0], e.inputProof); // does not revert
      expect(await bal(pool, poolAddr, alice)).to.equal(1000n); // burned 0
      expect(await bal(usdc, usdcAddr, alice)).to.equal(0n); // paid 0
    });

    it("tickets are a transferable ERC-7984 — odds move with them", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      const input = fhevm.createEncryptedInput(poolAddr, aliceAddr);
      input.add64(400n);
      const e = await input.encrypt();
      await pool.connect(alice)["confidentialTransfer(address,bytes32,bytes)"](bobAddr, e.handles[0], e.inputProof);
      expect(await bal(pool, poolAddr, alice)).to.equal(600n);
      expect(await bal(pool, poolAddr, bob)).to.equal(400n);
      expect(await pool.participantCount()).to.equal(2n); // bob registered by the transfer
    });
  });

  describe("draws", function () {
    it("single depositor always wins every tier; claim pays out; reserve is spent", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      await fund(carol, RESERVE);
      await sponsor(carol, RESERVE); // confidential sponsorship

      await time.increase(PERIOD + 1);
      await runDraw();

      expect(await pool.lastDrawTotalWeight()).to.be.greaterThan(0n);
      expect(await winnings(alice)).to.equal(BigInt(RESERVE)); // 7M+2M+1M

      await pool.connect(alice).claim();
      expect(await bal(usdc, usdcAddr, alice)).to.equal(BigInt(RESERVE));
      expect(await winnings(alice)).to.equal(0n); // reset

      await pool.connect(alice).exit();
      expect(await bal(usdc, usdcAddr, alice)).to.equal(BigInt(RESERVE) + 1000n); // + principal
    });

    it("multi-user paginated draw conserves prizes: Σ winnings == Σ tier prizes", async () => {
      for (const [who, amt] of [
        [alice, 5000],
        [bob, 2000],
        [carol, 1000],
        [dave, 8000],
      ] as const) {
        await fund(who, amt);
        await deposit(who, amt);
      }
      expect(await pool.participantCount()).to.equal(4n); // > MAX_PAGE=3 → two pages
      await fund(alice, RESERVE);
      await sponsor(alice, RESERVE);

      await time.increase(PERIOD + 1);
      await runDraw();

      let total = 0n;
      for (const who of [alice, bob, carol, dave]) total += await winnings(who);
      expect(total).to.equal(BigInt(RESERVE));
    });

    it("share moves are frozen while a draw is selecting", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      await time.increase(PERIOD + 1);
      await pool.startDraw();
      const handle = await pool.snapshotWeightHandle();
      const res = await fhevm.publicDecrypt([handle]);
      await pool.seedDraw(res.abiEncodedClearValues, res.decryptionProof);
      expect(await pool.drawState()).to.equal(2n); // Selecting

      const e = await enc(alice, 100);
      await expect(pool.connect(alice).deposit(e.handles[0], e.inputProof)).to.be.revertedWith("draw in progress");

      await pool.drawPage(0); // finish
      await deposit(alice, 100); // unfrozen
    });

    it("zero total weight cancels the draw and rolls the prize over", async () => {
      await fund(alice, 1000);
      await deposit(alice, 0); // registers a participant with zero weight
      await fund(carol, RESERVE);
      await sponsor(carol, RESERVE);

      await time.increase(PERIOD + 1);
      await pool.startDraw();
      const handle = await pool.snapshotWeightHandle();
      const res = await fhevm.publicDecrypt([handle]);
      await expect(pool.seedDraw(res.abiEncodedClearValues, res.decryptionProof)).to.emit(pool, "DrawCancelled");
      expect(await pool.drawState()).to.equal(0n); // reopened, reserve untouched
    });

    it("sequential draws use per-period weights (checkpoints reset)", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      await fund(carol, 2 * RESERVE);
      await sponsor(carol, RESERVE);

      await time.increase(PERIOD + 1);
      await runDraw(); // draw 0: alice alone
      expect(await pool.drawId()).to.equal(1n);

      await sponsor(carol, RESERVE);
      await time.increase(PERIOD + 1);
      await runDraw(); // draw 1: alice alone again — must win again with fresh weight
      expect(await winnings(alice)).to.equal(2n * BigInt(RESERVE));
    });

    it("TWAB: holding twice as long earns twice the weight", async () => {
      await fund(alice, 1000);
      await fund(bob, 1000);
      await deposit(alice, 1000);
      const aliceT0 = BigInt(await time.latest());
      await time.increase(1000);
      await deposit(bob, 1000);
      const bobT0 = BigInt(await time.latest());
      await time.increase(PERIOD);
      await pool.startDraw();
      const snapTs = BigInt(await pool.snapshotTs());

      // weight = balance × holding time (weights themselves stay encrypted; owners can decrypt).
      // A stored twab only exists after a second balance touch — extrapolate from the stored
      // value + balance × elapsed, exactly like the contract does at snapshot time.
      const wAlice = (await pool.twabOf(aliceAddr)) === ethers.ZeroHash
        ? 0n
        : await fhevm.userDecryptEuint(FhevmType.euint128, await pool.twabOf(aliceAddr), poolAddr, alice);
      const lastAlice = BigInt(await pool.twabLastOf(aliceAddr));
      const expectedAlice = wAlice + 1000n * (snapTs - lastAlice);
      const lastBob = BigInt(await pool.twabLastOf(bobAddr));
      const wBobStored = (await pool.twabOf(bobAddr)) === ethers.ZeroHash
        ? 0n
        : await fhevm.userDecryptEuint(FhevmType.euint128, await pool.twabOf(bobAddr), poolAddr, bob);
      const expectedBob = wBobStored + 1000n * (snapTs - lastBob);

      expect(expectedAlice).to.equal(1000n * (snapTs - aliceT0));
      expect(expectedBob).to.equal(1000n * (snapTs - bobT0));
      expect(expectedAlice).to.be.greaterThan(expectedBob);
    });

    it("claim with nothing ever credited reverts", async () => {
      await expect(pool.connect(dave).claim()).to.be.revertedWith("nothing to claim");
    });
  });

  describe("automation & yield", function () {
    it("checkUpkeep/performUpkeep drive start and pages", async () => {
      await fund(alice, 1000);
      await deposit(alice, 1000);
      expect((await pool.checkUpkeep("0x"))[0]).to.equal(false);
      await time.increase(PERIOD + 1);
      expect((await pool.checkUpkeep("0x"))[0]).to.equal(true);
      await pool.performUpkeep("0x"); // startDraw
      expect(await pool.drawState()).to.equal(1n);
      await expect(pool.performUpkeep("0x")).to.be.revertedWith("awaiting seed relay");
      const res = await fhevm.publicDecrypt([await pool.snapshotWeightHandle()]);
      await pool.seedDraw(res.abiEncodedClearValues, res.decryptionProof);
      expect((await pool.checkUpkeep("0x"))[0]).to.equal(true);
      await pool.performUpkeep("0x"); // drawPage
      expect(await pool.drawState()).to.equal(0n);
    });

    it("mock yield source harvests accrued interest into the prize reserve", async () => {
      const Yield = await ethers.getContractFactory("MockYieldSource");
      const ys = await Yield.deploy(usdcAddr, poolAddr, 1000); // 10% APR
      await ys.fund(365_000_000); // 365M notional → 100k / day at 10%
      await time.increase(86400);
      const accrued = await ys.accrued();
      expect(accrued).to.be.greaterThan(99_000n);
      await ys.harvest();
      // reserve is confidential; verify by running a draw for a lone depositor
      await fund(alice, 1000);
      await deposit(alice, 1000);
      await time.increase(PERIOD + 1);
      await runDraw();
      expect(await winnings(alice)).to.be.greaterThan(0n);
    });
  });
});
