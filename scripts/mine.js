const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = "https://rpc.vibes.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY missing in .env");
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const contractAddress = "0x47FAf4Ee3369EBF6867Aa8044A88015A8Ff1B0d3";

  const abi = [
    "function mine() external returns (uint256)",
    "function currentReward() view returns (uint256)",
    "function mineCount() view returns (uint256)",
    "function mineableSupply() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, wallet);

  console.log("==========================================");
  console.log("⛏️  ZBTC INTERACTIVE MINER");
  console.log("==========================================");
  console.log(`Miner Address: ${wallet.address}`);
  
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance:   ${ethers.formatEther(ethBalance)} ETH`);

  const [rewardBefore, mineCountBefore, mineableSupplyBefore, zbtcBalanceBefore] = await Promise.all([
    contract.currentReward(),
    contract.mineCount(),
    contract.mineableSupply(),
    contract.balanceOf(wallet.address)
  ]);

  console.log("------------------------------------------");
  console.log(`Current Mine Number:   #${mineCountBefore}`);
  console.log(`Block Mining Reward:   ${ethers.formatUnits(rewardBefore, 18)} ZBTC`);
  console.log(`Mineable Pool Left:    ${ethers.formatUnits(mineableSupplyBefore, 18)} ZBTC`);
  console.log(`Miner ZBTC Balance:    ${ethers.formatUnits(zbtcBalanceBefore, 18)} ZBTC`);
  console.log("------------------------------------------");

  console.log("Submitting mine() transaction to Base Vibenet...");
  const tx = await contract.mine();
  console.log(`Transaction Hash: ${tx.hash}`);
  console.log("Waiting for block confirmation...");

  const receipt = await tx.wait();
  console.log(`Confirmed in Block: #${receipt.blockNumber} (Gas Used: ${receipt.gasUsed})`);

  const [rewardAfter, mineCountAfter, mineableSupplyAfter, zbtcBalanceAfter] = await Promise.all([
    contract.currentReward(),
    contract.mineCount(),
    contract.mineableSupply(),
    contract.balanceOf(wallet.address)
  ]);

  console.log("==========================================");
  console.log("🎉 MINE SUCCESSFUL!");
  console.log("==========================================");
  console.log(`Mined Reward:          +${ethers.formatUnits(rewardBefore, 18)} ZBTC`);
  console.log(`New Miner ZBTC Bal:    ${ethers.formatUnits(zbtcBalanceAfter, 18)} ZBTC`);
  console.log(`Next Block Reward:     ${ethers.formatUnits(rewardAfter, 18)} ZBTC`);
  console.log(`Remaining Pool:        ${ethers.formatUnits(mineableSupplyAfter, 18)} ZBTC`);
  console.log(`Total Mines Completed: #${mineCountAfter}`);
  console.log(`Explorer Link: https://chain.base.org/vibenet/explorer/tx/${tx.hash}`);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("❌ Mining Error:", err.message);
  process.exit(1);
});
