const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeflationaryZBTC", function () {
  let owner;
  let token;

  const founderSupply = ethers.parseEther("1000000");
  const mineablePool = ethers.parseEther("20000000");
  const firstReward = ethers.parseEther("50");
  const secondReward = ethers.parseEther("25");

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const DeflationaryZBTC = await ethers.getContractFactory("DeflationaryZBTC");
    token = await DeflationaryZBTC.deploy(owner.address);
    await token.waitForDeployment();
  });

  it("mints the founder allocation and initializes the mineable pool", async function () {
    expect(await token.name()).to.equal("Deflationary ZBTC");
    expect(await token.symbol()).to.equal("ZBTC");
    expect(await token.balanceOf(owner.address)).to.equal(founderSupply);
    expect(await token.mineableSupply()).to.equal(mineablePool);
    expect(await token.currentReward()).to.equal(firstReward);
  });

  it("mints the initial reward and updates the mineable supply", async function () {
    const beforeBalance = await token.balanceOf(owner.address);
    await token.mine();
    const afterBalance = await token.balanceOf(owner.address);

    expect(afterBalance - beforeBalance).to.equal(firstReward);
    expect(await token.totalSupply()).to.equal(founderSupply + firstReward);
    expect(await token.mineableSupply()).to.equal(mineablePool - firstReward);
  });

  it("halves the reward every two mine calls", async function () {
    await token.mine();
    expect(await token.currentReward()).to.equal(secondReward);

    const beforeBalance = await token.balanceOf(owner.address);
    await token.mine();
    const afterBalance = await token.balanceOf(owner.address);

    expect(afterBalance - beforeBalance).to.equal(secondReward);
    expect(await token.mineableSupply()).to.equal(mineablePool - firstReward - secondReward);
  });
});
