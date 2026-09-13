const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const personalWallet = "0xca965C054a2D563F0c72ea418f851C7f8371aaB8";

  console.log("==========================================");
  console.log("🚀 DEPLOYING ProductionZBTC CONTRACT");
  console.log("==========================================");
  console.log(`Deployer Address:     ${deployer.address}`);
  console.log(`Founder Destination:  ${personalWallet}`);

  const ProductionZBTC = await ethers.getContractFactory("ProductionZBTC");
  // Deploy specifying your personal wallet as founder recipient
  const token = await ProductionZBTC.deploy(personalWallet);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const founderBal = await token.balanceOf(personalWallet);
  const remainingMineable = await token.remainingMineableSupply();
  const currentReward = await token.currentReward();

  console.log("------------------------------------------");
  console.log(`✅ ProductionZBTC Deployed To: ${tokenAddress}`);
  console.log(`Founder Allocation:           ${ethers.formatUnits(founderBal, 18)} ZBTC`);
  console.log(`Mineable Supply Reserve:      ${ethers.formatUnits(remainingMineable, 18)} ZBTC`);
  console.log(`Initial Block Reward:         ${ethers.formatUnits(currentReward, 18)} ZBTC`);
  console.log(`Explorer Link: https://chain.base.org/vibenet/explorer/address/${tokenAddress}`);
  console.log("==========================================");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
