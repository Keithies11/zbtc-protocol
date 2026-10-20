const { ethers, network } = require("hardhat");
require("dotenv").config();

async function main() {
  if (!["baseSepolia", "baseMainnet"].includes(network.name)) {
    throw new Error("Refusing deployment: select baseSepolia or baseMainnet explicitly.");
  }
  if (network.name === "baseMainnet" && process.env.CONFIRM_MAINNET_DEPLOY !== "YES") {
    throw new Error("Refusing Base Mainnet deployment: set CONFIRM_MAINNET_DEPLOY=YES only after reviewing the parameters.");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployment signer is configured. Set a valid PRIVATE_KEY in .env.");
  }
  const expectedChainId = network.name === "baseMainnet" ? 8453n : 84532n;
  const actualNetwork = await ethers.provider.getNetwork();
  if (actualNetwork.chainId !== expectedChainId) {
    throw new Error(`Configured network ${network.name} connected to unexpected chain ID ${actualNetwork.chainId}; expected ${expectedChainId}.`);
  }

  const founderDestination = process.env.FOUNDER_WALLET_ADDRESS || "0x93DeEdc7e8A621C1165159bE94e957594796D15D";
  if (!ethers.isAddress(founderDestination)) {
    throw new Error("FOUNDER_WALLET_ADDRESS must be a valid EVM address.");
  }
  const founderAddress = ethers.getAddress(founderDestination);

  console.log("==================================================");
  console.log("🚀 PRODUCTION ZBTC v2 PRE-DEPLOYMENT & DEPLOY");
  console.log("==================================================");
  console.log(`Network:              ${network.name}`);
  console.log(`Deployer:             ${deployer.address}`);
  console.log(`Founder Destination:  ${founderAddress}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance:     ${ethers.formatEther(balance)} ETH`);

  const feeData = await ethers.provider.getFeeData();
  console.log(`Gas Price:            ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} Gwei`);

  const ProductionZBTCv2 = await ethers.getContractFactory("ProductionZBTCv2");
  
  // Estimate gas before sending
  const deployTx = await ProductionZBTCv2.getDeployTransaction(founderAddress);
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const maxGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (maxGasPrice === null || maxGasPrice === undefined || maxGasPrice <= 0n) {
    throw new Error("Unable to determine a valid gas price; refusing deployment.");
  }
  const estimatedCostWei = (estimatedGas * 120n / 100n) * maxGasPrice;
  
  console.log("--------------------------------------------------");
  console.log(`Estimated Gas Units:  ${estimatedGas.toString()}`);
  console.log(`Estimated Deploy Fee: ~${ethers.formatEther(estimatedCostWei)} ETH`);
  console.log("--------------------------------------------------");

  if (balance < estimatedCostWei) {
    throw new Error(`Insufficient gas funds: have ${ethers.formatEther(balance)} ETH, need approximately ${ethers.formatEther(estimatedCostWei)} ETH including a 20% gas margin.`);
  }

  console.log("Broadcasting v2 deployment transaction to network...");
  const token = await ProductionZBTCv2.deploy(founderAddress);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("==================================================");
  console.log("✅ PRODUCTION ZBTC v2 DEPLOYED SUCCESSFULLY!");
  console.log("==================================================");
  console.log(`Contract Address:     ${tokenAddress}`);
  console.log(`Founder Allocation:   1,000,000 ZBTC minted to ${founderAddress}`);
  console.log(`Mineable Reserve:     20,000,000 ZBTC ready for mining`);
  console.log("==================================================");
  console.log("To verify on BaseScan, run:");
  console.log(`npx hardhat verify --network ${network.name} ${tokenAddress} "${founderAddress}"`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Pre-deployment error:", error.message || error);
  process.exitCode = 1;
});
