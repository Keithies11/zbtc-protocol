const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProductionZBTC", function () {
  let token, owner, miner1, miner2;

  beforeEach(async function () {
    [owner, miner1, miner2] = await ethers.getSigners();
    const ProductionZBTC = await ethers.getContractFactory("ProductionZBTC");
    token = await ProductionZBTC.deploy(owner.address);
    await token.waitForDeployment();
  });

  it("Should correctly mint founder 1M allocation", async function () {
    const founderBal = await token.balanceOf(owner.address);
    expect(founderBal).to.equal(ethers.parseEther("1000000"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));
    expect(await token.remainingMineableSupply()).to.equal(ethers.parseEther("20000000"));
  });

  it("Should allow miner1 to mine 50 ZBTC initially", async function () {
    await token.connect(miner1).mine();
    expect(await token.balanceOf(miner1.address)).to.equal(ethers.parseEther("50"));
    expect(await token.totalMinedSupply()).to.equal(ethers.parseEther("50"));
    expect(await token.mineCount()).to.equal(1);
  });

  it("Should enforce per-address mining cooldown", async function () {
    await token.connect(miner1).mine();
    
    // Immediate second mine by miner1 should revert
    await expect(token.connect(miner1).mine()).to.be.revertedWith("Mining cooldown in effect");

    // But miner2 can mine immediately because cooldown is per address
    await token.connect(miner2).mine();
    expect(await token.balanceOf(miner2.address)).to.equal(ethers.parseEther("50"));

    // Fast forward 10 minutes (600s)
    await time.increase(600);

    // Miner1 can mine again
    await token.connect(miner1).mine();
    expect(await token.balanceOf(miner1.address)).to.equal(ethers.parseEther("100"));
  });

  it("Should allow owner to adjust cooldown duration", async function () {
    await token.connect(owner).setMiningCooldown(60); // 1 minute
    expect(await token.miningCooldown()).to.equal(60);
  });
});
