const INITIAL_REWARD_WEI = 50n * 10n ** 18n;
const CLAIMS_PER_EPOCH = 200_000n;
const FOUNDER_WEI = 1_000_000n * 10n ** 18n;
const CAP_WEI = 21_000_000n * 10n ** 18n;
const YEAR_MINUTES = 365.25 * 24 * 60;

function cooldownMinutes(epoch) {
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > 63) {
    throw new RangeError("Epoch must be an integer from 0 to 63");
  }
  return epoch === 0 ? 10n : 30n * 2n ** BigInt(epoch - 1);
}

function formatToken(wei) {
  const scale = 10n ** 18n;
  const fraction = (wei % scale).toString().padStart(18, "0").replace(/0+$/, "");
  return `${wei / scale}${fraction ? `.${fraction}` : ""}`;
}

function buildSchedule() {
  let mintedWei = FOUNDER_WEI;
  let elapsedMinutes = 0n;
  return Array.from({ length: 64 }, (_, epoch) => {
    const rewardWei = INITIAL_REWARD_WEI >> BigInt(epoch);
    const minutes = cooldownMinutes(epoch);
    mintedWei += rewardWei * CLAIMS_PER_EPOCH;
    elapsedMinutes += minutes * CLAIMS_PER_EPOCH;
    return { epoch, cooldownMinutes: minutes, rewardWei, mintedWei,
      epochMinutes: minutes * CLAIMS_PER_EPOCH, elapsedMinutes };
  });
}

module.exports = { INITIAL_REWARD_WEI, CLAIMS_PER_EPOCH, FOUNDER_WEI, CAP_WEI,
  YEAR_MINUTES, cooldownMinutes, formatToken, buildSchedule };

if (require.main === module) {
  const rows = buildSchedule();
  console.log("PROPOSAL ONLY: 10, 30, 60, 120... minutes; no chain transactions.");
  console.log("Idealized continuous participation, fixed address count; first-claim offsets, gas, block capacity and inactivity excluded.");
  console.log("epoch | cooldown minutes | reward ZBTC | cumulative supply | epoch years (1 address) | cumulative years (1 address)");
  for (const row of rows.slice(0, 10)) {
    console.log([row.epoch, row.cooldownMinutes, formatToken(row.rewardWei), formatToken(row.mintedWei),
      (Number(row.epochMinutes) / YEAR_MINUTES).toFixed(4),
      (Number(row.elapsedMinutes) / YEAR_MINUTES).toFixed(4)].join(" | "));
  }
  console.log("\nInitial 50-ZBTC reward at fixed cooldowns:");
  for (const minutes of [10, 30, 60, 120]) {
    console.log(`${minutes} min: ${(1440 / minutes).toFixed(0)} claims/day/address, ${(1440 / minutes * 50).toFixed(0)} ZBTC/day/address; ${(200000 * minutes / YEAR_MINUTES).toFixed(4)} years/epoch/address`);
  }
  const last = rows.at(-1);
  console.log("\nProposed cumulative years by participating address count:");
  for (const count of [1, 3, 10, 100]) {
    console.log(`${count} addresses: first halving ${(Number(rows[0].elapsedMinutes) / YEAR_MINUTES / count).toFixed(4)} years; end epoch 6 ${(Number(rows[6].elapsedMinutes) / YEAR_MINUTES / count).toFixed(4)} years; end epoch 9 ${(Number(rows[9].elapsedMinutes) / YEAR_MINUTES / count).toFixed(4)} years; end epoch 63 ${(Number(last.elapsedMinutes) / YEAR_MINUTES / count).toExponential(6)} years`);
  }
  console.log(`\nAfter 12,800,000 claims: ${formatToken(last.mintedWei)} ZBTC total.`);
  console.log(`Unminted cap difference: ${formatToken(CAP_WEI - last.mintedWei)} ZBTC (${CAP_WEI - last.mintedWei} token wei).`);
  console.log(`Epoch 63 reward: ${last.rewardWei} token wei. Epoch 64 reward is zero by contract guard.`);
  console.log("Time to exactly 21,000,000: NEVER under current contract, regardless of cooldown.");
  console.log(`Constant 10-minute comparison: ${(64 * 200000 * 10 / YEAR_MINUTES).toFixed(4)} idealized years/address to epoch 64.`);
}
