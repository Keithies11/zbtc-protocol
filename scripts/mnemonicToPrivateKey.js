const { ethers } = require("ethers");

async function main() {
  // 1) PUT YOUR MNEMONIC (SEED PHRASE) HERE, BETWEEN THE QUOTES
  //
  //    IMPORTANT:
  //    - Do NOT share this phrase with anyone.
  //    - Do NOT commit this file to GitHub.
  //    - Use it ONLY locally.
  //
  const mnemonic = "move dose young arena sight obvious retreat van among legend shift timber";

  // 2) Create an HD wallet from the mnemonic
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);

  console.log("====================================");
  console.log(" MNEMONIC → PRIVATE KEY CONVERTER");
  console.log("====================================\n");

  console.log("Address:");
  console.log(wallet.address + "\n");

  console.log("Private Key:");
  console.log(wallet.privateKey + "\n");

  console.log("====================================");
  console.log(" Copy ONLY the PRIVATE KEY into .env");
  console.log(" Example:");
  console.log(" PRIVATE_KEY=" + wallet.privateKey);
  console.log("====================================");
}

main().catch((err) => {
  console.error("Error:", err);
});
