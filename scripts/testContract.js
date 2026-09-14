const { ethers } = require("ethers");
require("dotenv").config({ path: __dirname + "/../.env" });

const BASE_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://mainnet.base.org",
  "https://base.llamarpc.com"
];

async function main() {
  const targetContract = process.argv[2] || "0x7eAa5CAb87ed0516B1A16c5E71D8794E97C2314E"; // Default to v2, or pass v1 address
  let provider = new ethers.JsonRpcProvider(BASE_RPCS[0]);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY missing in .env");
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function mineCount() view returns (uint256)",
    "function currentReward() view returns (uint256)",
    "function cooldownRemaining(address miner) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function mine() external returns (uint256)",
    "function owner() view returns (address)"
  ];

  const contract = new ethers.Contract(targetContract, abi, wallet);

  console.log("==========================================");
  console.log("⛏️  ZBTC CONTRACT TESTING & INTERACTION SCRIPT");
  console.log("==========================================");
  console.log(`Tester Address:   ${wallet.address}`);
  console.log(`Contract Address: ${targetContract}`);

  const [name, symbol, totalSupply, mineCount, reward, cooldown, ownerAddr, bal, ethBal] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.totalSupply(),
    contract.mineCount(),
    contract.currentReward(),
    contract.cooldownRemaining(wallet.address),
    contract.owner(),
    contract.balanceOf(wallet.address),
    provider.getBalance(wallet.address)
  ]);

  console.log("------------------------------------------");
  console.log(`Token Name:       ${name} (${symbol})`);
  console.log(`On-Chain Owner:   ${ownerAddr}`);
  console.log(`Total Supply:     ${ethers.formatUnits(totalSupply, 18)} ${symbol}`);
  console.log(`Global Mine Count:#${mineCount}`);
  console.log(`Current Reward:   ${ethers.formatUnits(reward, 18)} ${symbol}`);
  console.log(`Tester ETH Bal:   ${ethers.formatEther(ethBal)} ETH`);
  console.log(`Tester Token Bal: ${ethers.formatUnits(bal, 18)} ${symbol}`);
  console.log(`Cooldown Left:    ${cooldown.toString()} seconds`);
  console.log("------------------------------------------");

  if (Number(cooldown) > 0) {
    console.log(`⏳ Cooldown active (${cooldown.toString()}s remaining). Cannot mine right now.`);
    return;
  }

  if (ethBal === 0n) {
    console.log("⚠️ Wallet has 0 Base ETH for gas. Cannot execute on-chain test mine.");
    return;
  }

  console.log("🚀 Cooldown ready! Executing test mine()...");
  const tx = await contract.mine();
  console.log(`Tx submitted: https://basescan.org/tx/${tx.hash}`);
  console.log("Waiting for block confirmation...");
  const receipt = await tx.wait();
  console.log(`✅ Success in block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed}`);

  const newBal = await contract.balanceOf(wallet.address);
  console.log(`New Token Balance: ${ethers.formatUnits(newBal, 18)} ${symbol}`);
}

main().catch((err) => {
  console.error("❌ Test script error:", err.message || err);
  process.exit(1);
});
