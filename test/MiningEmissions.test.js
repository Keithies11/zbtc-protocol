const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { buildSchedule, cooldownMinutes, formatToken, CAP_WEI, YEAR_MINUTES } = require("../scripts/mining-emissions");

describe("Mining emissions proposal (read-only)", function () {
  it("uses the chosen cooldown sequence without changing the contract", function () {
    expect(Array.from({ length: 6 }, (_, epoch) => cooldownMinutes(epoch))).to.deep.equal([10n, 30n, 60n, 120n, 240n, 480n]);
    for (const epoch of [-1, 0.5, 64, NaN]) expect(() => cooldownMinutes(epoch)).to.throw(RangeError);
    const source = fs.readFileSync(path.join(__dirname, "../contracts/ProductionZBTCv2.sol"), "utf8");
    expect(source).to.include("uint256 public miningCooldown = 10 minutes;");
    expect(source).to.include("if (epoch >= 64)");
  });

  it("calculates halving rewards, cumulative supply and participant-dependent time", function () {
    const rows = buildSchedule();
    expect(rows).to.have.length(64);
    expect(formatToken(rows[0].mintedWei)).to.equal("11000000");
    expect(formatToken(rows[1].mintedWei)).to.equal("16000000");
    expect(formatToken(rows[2].mintedWei)).to.equal("18500000");
    expect(formatToken(rows[6].mintedWei)).to.equal("20843750");
    expect(formatToken(rows[9].mintedWei)).to.equal("20980468.75");
    expect(rows[0].elapsedMinutes).to.equal(2_000_000n);
    expect(rows[1].elapsedMinutes).to.equal(8_000_000n);
    expect(Number(rows[0].elapsedMinutes) / YEAR_MINUTES).to.be.closeTo(3.80257054, 0.0000001);
    expect(Number(rows[0].elapsedMinutes) / YEAR_MINUTES / 100).to.be.closeTo(0.0380257054, 0.00000001);
    expect(rows.every((row) => row.mintedWei < CAP_WEI)).to.equal(true);
  });

  it("accounts exactly for integer reward rounding and the epoch-64 cutoff", function () {
    const last = buildSchedule().at(-1);
    expect(last.rewardWei).to.equal(5n);
    expect(CAP_WEI - last.mintedWei).to.equal(5_800_000n);
    expect(formatToken(last.mintedWei)).to.equal("20999999.9999999999942");
    expect(formatToken(CAP_WEI - last.mintedWei)).to.equal("0.0000000000058");
    expect(last.elapsedMinutes).to.equal(200_000n * (10n + 30n * (2n ** 63n - 1n)));
  });

  it("keeps mining near the top with visible safety warnings and accessible rule details", function () {
    const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
    expect(html).to.include("Automated multi-address farming");
    expect(html).to.include("not automatically enforced");
    expect(html).to.include("0.0000000000058");
    expect(html.indexOf("Automated multi-address farming")).to.be.lessThan(html.indexOf('id="mineBtn"'));
    expect(html.indexOf('class="card mining-card"')).to.be.lessThan(html.indexOf('aria-label="ZBTC liquidity status"'));
    expect(html.indexOf("Mining costs real Base ETH")).to.be.lessThan(html.indexOf('id="mineBtn"'));
    expect(html).to.include("<summary>Mining rules, emissions and value disclosures</summary>");
    for (const id of ["mineBtn", "minePill", "cooldownMsg", "statusMsg", "gasEstimate", "progressFill"]) {
      expect(html.match(new RegExp(`id="${id}"`, "g"))).to.have.length(1);
    }
  });
});
