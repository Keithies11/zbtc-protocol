const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const { buildSchedule, CAP_WEI } = require("../scripts/mining-emissions");

describe("ProductionZBTCv2", function () {
  let token;
  let owner;
  let miner1;
  let newOwner;

  beforeEach(async function () {
    [owner, miner1, newOwner] = await ethers.getSigners();
    const ProductionZBTCv2 = await ethers.getContractFactory("ProductionZBTCv2");
    token = await ProductionZBTCv2.deploy(owner.address);
    await token.waitForDeployment();
  });

  it("Should correctly mint founder 1M allocation and initialize cap", async function () {
    const founderBal = await token.balanceOf(owner.address);
    expect(founderBal).to.equal(ethers.parseEther("1000000"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));
    expect(await token.TOTAL_SUPPLY_CAP()).to.equal(ethers.parseEther("21000000"));
  });

  it("Should allow miner1 to mine 50 ZBTC initially", async function () {
    await token.connect(miner1).mine();
    const minerBal = await token.balanceOf(miner1.address);
    expect(minerBal).to.equal(ethers.parseEther("50"));
    expect(await token.mineCount()).to.equal(1n);
  });

  it("Should enforce per-address mining cooldown", async function () {
    await token.connect(miner1).mine();
    await expect(token.connect(miner1).mine()).to.be.revertedWith("Mining cooldown in effect");
  });

  it("Should support Ownable2Step ownership transfer", async function () {
    await token.connect(owner).transferOwnership(newOwner.address);
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.pendingOwner()).to.equal(newOwner.address);

    await token.connect(newOwner).acceptOwnership();
    expect(await token.owner()).to.equal(newOwner.address);
  });

  it("allows independent addresses to claim without a per-person emission limit", async function () {
    await token.connect(miner1).mine();
    await token.connect(newOwner).mine();
    expect(await token.balanceOf(newOwner.address)).to.equal(ethers.parseEther("50"));
    expect(await token.mineCount()).to.equal(2n);
    await expect(token.connect(miner1).mine()).to.be.revertedWith("Mining cooldown in effect");
  });

  it("restricts cooldown changes to the accepted owner and emits old/new values", async function () {
    await expect(token.connect(miner1).setMiningCooldown(3600))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount").withArgs(miner1.address);
    await token.transferOwnership(newOwner.address);
    await expect(token.connect(newOwner).setMiningCooldown(3600))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    await expect(token.setMiningCooldown(3600)).to.emit(token, "CooldownUpdated").withArgs(600, 3600);
    await token.connect(newOwner).acceptOwnership();
    await expect(token.setMiningCooldown(7200)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    await token.connect(newOwner).setMiningCooldown(7200);
    expect(await token.miningCooldown()).to.equal(7200n);
  });

  it("applies manual cooldown increases to existing claim timestamps, without an automatic schedule", async function () {
    await token.connect(miner1).mine();
    const last = await token.lastMinedTimestamp(miner1.address);
    await time.increaseTo(last + 600n);
    expect(await token.cooldownRemaining(miner1.address)).to.equal(0n);
    await token.setMiningCooldown(3600);
    const now = BigInt(await time.latest());
    expect(await token.cooldownRemaining(miner1.address)).to.equal(last + 3600n - now);
    await expect(token.connect(miner1).mine()).to.be.revertedWith("Mining cooldown in effect");
    await time.setNextBlockTimestamp(last + 3600n);
    await token.connect(miner1).mine();
    expect(await token.miningCooldown()).to.equal(3600n);
  });

  it("documents the deployed setter's lack of a minimum or maximum cooldown", async function () {
    await token.setMiningCooldown(0);
    await token.connect(miner1).mine();
    await token.connect(miner1).mine();
    expect(await token.mineCount()).to.equal(2n);
    await token.setMiningCooldown(ethers.MaxUint256);
    expect(await token.miningCooldown()).to.equal(ethers.MaxUint256);
    await expect(token.cooldownRemaining(miner1.address)).to.be.revertedWithPanic(0x11);
  });

  // Hardhat-only fixtures for distant epochs. Slots match this compiler's layout;
  // getter assertions deliberately fail if that layout changes.
  async function setCount(count) {
    await setStorageAt(await token.getAddress(), 9, count);
    expect(await token.mineCount()).to.equal(BigInt(count));
  }

  async function setMined(mined) {
    await setStorageAt(await token.getAddress(), 8, mined);
    expect(await token.totalMinedSupply()).to.equal(mined);
    await setStorageAt(await token.getAddress(), 2, ethers.parseEther("1000000") + mined);
    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000") + mined);
  }

  it("pays 50 on claim 200000, then 25 on claim 200001 without changing cooldown", async function () {
    await setCount(199999);
    await expect(token.connect(miner1).mine())
      .to.emit(token, "Mined").withArgs(miner1.address, ethers.parseEther("50"), 0, 200000);
    expect(await token.currentReward()).to.equal(ethers.parseEther("25"));
    await expect(token.connect(newOwner).mine())
      .to.emit(token, "Mined").withArgs(newOwner.address, ethers.parseEther("25"), 1, 200001);
    expect(await token.miningCooldown()).to.equal(600n);
  });

  it("ends epoch 63 with the exact unmintable tail and rejects further claims", async function () {
    const finalSupply = buildSchedule().at(-1).mintedWei;
    await setCount(12_799_999);
    await setMined(finalSupply - ethers.parseEther("1000000") - 5n);
    expect(await token.currentReward()).to.equal(5n);
    await token.connect(miner1).mine();
    expect(await token.currentEpoch()).to.equal(64n);
    expect(await token.currentReward()).to.equal(0n);
    expect(await token.totalSupply()).to.equal(finalSupply);
    expect(CAP_WEI - await token.totalSupply()).to.equal(5_800_000n);
    expect(await token.remainingMineableSupply()).to.equal(5_800_000n);
    await expect(token.connect(newOwner).mine()).to.be.revertedWith("Mining pool fully exhausted");
  });

  it("limits a final reward to the remaining reserve rather than exceeding the cap", async function () {
    await setMined(ethers.parseEther("20000000") - 25n);
    expect(await token.currentReward()).to.equal(25n);
    await token.connect(miner1).mine();
    expect(await token.totalSupply()).to.equal(CAP_WEI);
    expect(await token.remainingMineableSupply()).to.equal(0n);
    await expect(token.connect(newOwner).mine()).to.be.revertedWith("Mining pool fully exhausted");
  });
});
