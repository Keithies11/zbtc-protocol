const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const expectedDeploymentWallet = process.env.DEPLOYMENT_WALLET_ADDRESS;

  if (
    expectedDeploymentWallet &&
    deployer.address.toLowerCase() !== expectedDeploymentWallet.toLowerCase()
  ) {
    throw new Error(
      `Configured signer ${deployer.address} does not match DEPLOYMENT_WALLET_ADDRESS ${expectedDeploymentWallet}`
    );
  }

  console.log(`Deploying from dedicated wallet: ${deployer.address}`);
  const DeflationaryZBTC = await ethers.getContractFactory("DeflationaryZBTC");
  const token = await DeflationaryZBTC.deploy(deployer.address);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const founderBalance = await token.balanceOf(deployer.address);

  console.log(`DeflationaryZBTC deployed to: ${tokenAddress}`);
  console.log(`Founder balance: ${ethers.formatEther(founderBalance)} ZBTC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
