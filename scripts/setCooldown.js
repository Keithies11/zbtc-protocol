const { ethers } = require("ethers");
require("dotenv").config({ path: __dirname + "/../.env" });

async function main() {
  const newCooldownSeconds = parseInt(process.argv[2] || "60", 10);
  const rpcUrl = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY missing in .env");
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const contractAddress = "0x47FAf4Ee3369EBF6867Aa8044A88015A8Ff1B0d3";

  const abi = [
    "function owner() view returns (address)",
    "function miningCooldown() view returns (uint256)",
    "function setMiningCooldown(uint256 newCooldown) external"
  ];

  const contract = new ethers.Contract(contractAddress, abi, wallet);

  console.log("==========================================");
  console.log("⚙️  ZBTC SET MINING COOLDOWN SCRIPT");
  console.log("==========================================");
  console.log(`Wallet Address:   ${wallet.address}`);
  console.log(`Contract Address: ${contractAddress}`);

  const [contractOwner, currentCooldown] = await Promise.all([
    contract.owner(),
    contract.miningCooldown()
  ]);

  console.log(`Contract Owner:   ${contractOwner}`);
  console.log(`Current Cooldown: ${currentCooldown.toString()} seconds`);

  if (wallet.address.toLowerCase() !== contractOwner.toLowerCase()) {
    throw new Error(`Wallet ${wallet.address} is not the contract owner (${contractOwner})`);
  }

  const bal = await provider.getBalance(wallet.address);
  console.log(`Owner ETH Bal:    ${ethers.formatEther(bal)} ETH`);

  if (bal === 0n) {
    throw new Error("Owner wallet has 0 Base ETH for gas");
  }

  console.log(`\nUpdating mining cooldown to ${newCooldownSeconds} seconds...`);
  const tx = await contract.setMiningCooldown(newCooldownSeconds);
  console.log(`Tx submitted: https://basescan.org/tx/${tx.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`✅ Success in block #${receipt.blockNumber}! Mining cooldown is now ${newCooldownSeconds}s.`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
