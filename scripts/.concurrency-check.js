const hre = require("hardhat");

async function main() {
  if (!["hardhat", "localhost"].includes(hre.network.name)) {
    throw new Error(`Refusing concurrency test on ${hre.network.name}; use a local Hardhat network.`);
  }

  const signers = await hre.ethers.getSigners();
  if (signers.length < 20) throw new Error(`Need 20 signers, got ${signers.length}`);

  const Factory = await hre.ethers.getContractFactory("ProductionZBTCv2");
  const token = await Factory.deploy(signers[0].address);
  await token.waitForDeployment();

  const results = await Promise.all(signers.slice(0, 20).map(async (signer, index) => {
    try {
      const tx = await token.connect(signer).mine();
      const receipt = await tx.wait();
      return { index, address: signer.address, ok: true, hash: receipt.hash };
    } catch (error) {
      return { index, address: signer.address, ok: false, error: error.shortMessage || error.reason || error.message };
    }
  }));

  const mineCount = await token.mineCount();
  const reverts = results.filter((result) => !result.ok);
  console.log(JSON.stringify({
    network: "Hardhat local",
    contract: await token.getAddress(),
    submitted: results.length,
    succeeded: results.length - reverts.length,
    allSucceeded: reverts.length === 0,
    finalMineCount: mineCount.toString(),
    reverts,
  }, null, 2));
  if (reverts.length > 0 || mineCount !== 20n) {
    throw new Error(`Concurrency check failed: ${reverts.length} transaction(s) reverted; final mine count is ${mineCount}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
