const { expect } = require("chai");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

describe("V2 deployment safety (no network or signing)", function () {
  function load(network, env) {
    let signerReads = 0;
    const context = {
      module: { exports: {} }, process: { env },
      require: (name) => {
        if (name === "dotenv") return { config() {} };
        if (name === "hardhat") return {
          network: { name: network },
          ethers: { getSigners: async () => { signerReads++; throw new Error("signer boundary reached"); } },
        };
        throw new Error(`Unexpected module: ${name}`);
      },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../scripts/deployV2.js"), "utf8"), context);
    return { main: context.module.exports.main, signerReads: () => signerReads };
  }

  async function refuses(network, env, message) {
    const script = load(network, env);
    expect(script.signerReads()).to.equal(0);
    let error;
    try { await script.main(); } catch (err) { error = err; }
    expect(error?.message).to.include(message);
    expect(script.signerReads()).to.equal(0);
  }

  it("refuses unintended networks before touching a signer", async function () {
    await refuses("hardhat", {}, "select baseSepolia or baseMainnet");
  });

  it("requires all mainnet acknowledgements and an explicit founder", async function () {
    await refuses("baseMainnet", {}, "CONFIRM_MAINNET_DEPLOY");
    await refuses("baseMainnet", { CONFIRM_MAINNET_DEPLOY: "YES" }, "separate token");
    await refuses("baseMainnet", {
      CONFIRM_MAINNET_DEPLOY: "YES", CONFIRM_NEW_TOKEN: "DEPLOY_NEW_TOKEN_NO_UPGRADE",
    }, "explicit FOUNDER_WALLET_ADDRESS");
  });

  it("preserves Sepolia use and only reaches signing after complete mainnet approval", async function () {
    for (const [network, env] of [
      ["baseSepolia", {}],
      ["baseMainnet", {
        CONFIRM_MAINNET_DEPLOY: "YES", CONFIRM_NEW_TOKEN: "DEPLOY_NEW_TOKEN_NO_UPGRADE",
        FOUNDER_WALLET_ADDRESS: "0x0000000000000000000000000000000000000001",
      }],
    ]) {
      const script = load(network, env);
      let error;
      try { await script.main(); } catch (err) { error = err; }
      expect(error?.message).to.equal("signer boundary reached");
      expect(script.signerReads()).to.equal(1);
    }
  });
});
