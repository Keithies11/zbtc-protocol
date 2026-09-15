const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  // Use Base Mainnet RPC
  const rpcUrl = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY missing in .env");
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  // Active ProductionZBTCv2 address on Base Mainnet
  const contractAddress = "0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2";

  const abi = [
    "function mine() external returns (uint256)",
    "function currentReward() view returns (uint256)",
    "function mineCount() view returns (uint256)",
    "function mineableSupply() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function lastMineTime(address) view returns (uint256)",
    "function miningCooldown() view returns (uint256)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, wallet);

  console.log("==========================================");
  console.log("⛏️  ZBTC BASE MAINNET AUTOMATED MINER BOT");
  console.log("==========================================");
  console.log(`Miner Address:    ${wallet.address}`);
  console.log(`Contract Address: ${contractAddress}`);

  async function mineCycle() {
    try {
      const ethBal = await provider.getBalance(wallet.address);
      const [lastTime, cooldown, currentReward, zbtcBal, mineCount] = await Promise.all([
        contract.lastMineTime(wallet.address),
        contract.miningCooldown(),
        contract.currentReward(),
        contract.balanceOf(wallet.address),
        contract.mineCount()
      ]);

      const now = Math.floor(Date.now() / 1000);
      const nextEligible = Number(lastTime) + Number(cooldown);
      const remainingWait = nextEligible - now;

      console.log(`\n[${new Date().toLocaleTimeString()}] Status Check:`);
      console.log(`ETH Balance:        ${ethers.formatEther(ethBal)} ETH`);
      console.log(`ZBTC Balance:       ${ethers.formatUnits(zbtcBal, 18)} ZBTC`);
      console.log(`Global Mine Count:  #${mineCount}`);
      console.log(`Block Reward:       ${ethers.formatUnits(currentReward, 18)} ZBTC`);

      if (remainingWait > 0) {
        const mins = Math.ceil(remainingWait / 60);
        console.log(`⏳ Cooldown active: next mine available in ~${mins} minute(s) (${remainingWait}s). Sleeping...`);
        setTimeout(mineCycle, (remainingWait + 5) * 1000);
        return;
      }

      console.log("🚀 Cooldown expired! Executing mine() on Base Mainnet...");
      const tx = await contract.mine();
      console.log(`Transaction submitted: https://basescan.org/tx/${tx.hash}`);
      console.log("Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log(`✅ Success in block #${receipt.blockNumber} (Gas used: ${receipt.gasUsed})`);

      // Schedule next check right after cooldown (10 minutes + 5s buffer)
      const waitTime = (Number(cooldown) + 5) * 1000;
      console.log(`💤 Sleeping for ${Number(cooldown) / 60} minutes until next cycle...`);
      setTimeout(mineCycle, waitTime);
    } catch (err) {
      console.error("❌ Mining cycle error:", err.message);
      console.log("Retrying in 30 seconds...");
      setTimeout(mineCycle, 30000);
    }
  }

  // Start loop
  mineCycle();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
