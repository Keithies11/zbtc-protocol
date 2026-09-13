const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const founderDestination = process.env.DEPLOYMENT_WALLET_ADDRESS || deployer.address;

  console.log("==================================================");
  console.log("🚀 BASE MAINNET PRE-DEPLOYMENT SIMULATION & DEPLOY");
  console.log("==================================================");
  console.log(`Network:              ${hre.network.name}`);
  console.log(`Deployer:             ${deployer.address}`);
  console.log(`Founder Destination:  ${founderDestination}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance:     ${ethers.formatEther(balance)} ETH`);

  const feeData = await ethers.provider.getFeeData();
  console.log(`Gas Price:            ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} Gwei`);

  const ProductionZBTC = await ethers.getContractFactory("ProductionZBTC");
  
  // Estimate gas before sending
  const deployTx = await ProductionZBTC.getDeployTransaction(founderDestination);
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const estimatedCostWei = estimatedGas * (feeData.gasPrice || 100000000n);
  
  console.log("--------------------------------------------------");
  console.log(`Estimated Gas Units:  ${estimatedGas.toString()}`);
  console.log(`Estimated Deploy Fee: ~${ethers.formatEther(estimatedCostWei)} ETH`);
  console.log("--------------------------------------------------");

  if (balance < estimatedCostWei) {
    throw new Error(`Insufficient funds: Need ~${ethers.formatEther(estimatedCostWei)} ETH, have ${ethers.formatEther(balance)} ETH`);
  }

  console.log("Broadcasting deployment transaction to network...");
  const token = await ProductionZBTC.deploy(founderDestination);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("==================================================");
  console.log("✅ CONTRACT DEPLOYED SUCCESSFULLY!");
  console.log("==================================================");
  console.log(`Contract Address:     ${tokenAddress}`);
  console.log(`Founder Allocation:   1,000,000 ZBTC minted to ${founderDestination}`);
  console.log(`Mineable Reserve:     20,000,000 ZBTC ready for mining`);
  console.log("==================================================");
  console.log("To verify on BaseScan, run:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${tokenAddress} "${founderDestination}"`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Pre-deployment error:", error.message);
  process.exitCode = 1;
});
