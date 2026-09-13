const { expect } = require("chai");
const { ethers } = require("hardhat");

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
});
