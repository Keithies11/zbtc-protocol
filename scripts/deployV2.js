const { ethers, network } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const founderDestination = process.env.FOUNDER_WALLET_ADDRESS || "0x93DeEdc7e8A621C1165159bE94e957594796D15D";

  console.log("==================================================");
  console.log("🚀 PRODUCTION ZBTC v2 PRE-DEPLOYMENT & DEPLOY");
  console.log("==================================================");
  console.log(`Network:              ${network.name}`);
  console.log(`Deployer:             ${deployer.address}`);
  console.log(`Founder Destination:  ${founderDestination}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance:     ${ethers.formatEther(balance)} ETH`);

  const feeData = await ethers.provider.getFeeData();
  console.log(`Gas Price:            ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} Gwei`);

  const ProductionZBTCv2 = await ethers.getContractFactory("ProductionZBTCv2");
  
  // Estimate gas before sending
  const deployTx = await ProductionZBTCv2.getDeployTransaction(founderDestination);
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const estimatedCostWei = estimatedGas * (feeData.gasPrice || 100000000n);
  
  console.log("--------------------------------------------------");
  console.log(`Estimated Gas Units:  ${estimatedGas.toString()}`);
  console.log(`Estimated Deploy Fee: ~${ethers.formatEther(estimatedCostWei)} ETH`);
  console.log("--------------------------------------------------");

  if (balance < estimatedCostWei) {
    console.warn(`⚠️ Insufficient gas funds: Have ${ethers.formatEther(balance)} ETH, need ~${ethers.formatEther(estimatedCostWei)} ETH.`);
    console.warn("Fund the deployer address above before running live network broadcast.");
    return;
  }

  console.log("Broadcasting v2 deployment transaction to network...");
  const token = await ProductionZBTCv2.deploy(founderDestination);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("==================================================");
  console.log("✅ PRODUCTION ZBTC v2 DEPLOYED SUCCESSFULLY!");
  console.log("==================================================");
  console.log(`Contract Address:     ${tokenAddress}`);
  console.log(`Founder Allocation:   1,000,000 ZBTC minted to ${founderDestination}`);
  console.log(`Mineable Reserve:     20,000,000 ZBTC ready for mining`);
  console.log("==================================================");
  console.log("To verify on BaseScan, run:");
  console.log(`npx hardhat verify --network ${network.name} ${tokenAddress} "${founderDestination}"`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Pre-deployment error:", error.message || error);
  process.exitCode = 1;
});
