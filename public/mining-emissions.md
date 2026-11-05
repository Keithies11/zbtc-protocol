# ZBTC mining emissions and cooldown proposal

Status: proposal only, reviewed 5 November 2026. No contract or liquidity changes
are made by this document or calculator. Always check the deployed cooldown.

## Current rules

- 1,000,000 ZBTC was minted to the founder at deployment; it is not mined.
- The supply cap is 21,000,000 ZBTC, with a nominal 20,000,000 mining reserve.
- Rewards start at 50 ZBTC and halve every 200,000 successful global claims.
- The contract currently uses one owner-adjustable cooldown (600 seconds when
  reviewed), applied separately to each claiming address.
- Contract wallets and multiple addresses can claim. Addresses are not people.
- The existing deployment has no automatic epoch-dependent cooldown. The owner
  can manually change the global cooldown after a halving. Automatic enforcement
  would need different contract logic/deployment; a website timer cannot enforce
  it. No migration or on-chain change is approved here.
- A change affects all addresses, using their last successful claim timestamp;
  it is not a separate timer reserved only for newly joining miners.

## Fixed-cooldown comparison at the initial 50-ZBTC reward

| Cooldown | Claims/day/address | ZBTC/day/address | Years for 200,000 claims with one address |
|---|---:|---:|---:|
| 10 minutes | 144 | 7,200 | 3.8026 |
| 30 minutes | 48 | 2,400 | 11.4077 |
| 60 minutes | 24 | 1,200 | 22.8154 |
| 120 minutes | 12 | 600 | 45.6308 |

These are sustained-rate illustrations, not exact completion times. They assume
continuous successful participation, a fixed number of addresses, instantaneous
cooldown updates at boundaries and no gas, block-capacity or availability limits.
An address's first claim can occur immediately; that small startup offset is
ignored. For N equally active addresses, multiply emissions by N and divide time
by N. Participation can change, so there is no fixed completion date.

Three addresses at 30 minutes emit the same initial sustained rate as one at
10 minutes. Six addresses at 60 minutes also do. Increasing cooldown does not
solve multi-address farming. At later epochs, rewards halve too.

## Proposed epoch schedule

Epoch 0 is the first 200,000 claims. After that: 30 minutes, then 60, 120,
240, 480 minutes, doubling each epoch with no maximum cooldown in this proposal.

Supply includes the founder allocation. Times start from the beginning of mining,
not today; existing claims count toward the first epoch.

| Epoch | Global claim numbers | Cooldown | Reward ZBTC | Supply at epoch end | Epoch years, 1 address | Cumulative years, 1 address |
|---|---|---|---:|---:|---:|---:|
| 0 | 1-200,000 | 10 min | 50 | 11,000,000 | 3.8026 | 3.8026 |
| 1 | 200,001-400,000 | 30 min | 25 | 16,000,000 | 11.4077 | 15.2103 |
| 2 | 400,001-600,000 | 60 min | 12.5 | 18,500,000 | 22.8154 | 38.0257 |
| 3 | 600,001-800,000 | 120 min | 6.25 | 19,750,000 | 45.6308 | 83.6566 |
| 4 | 800,001-1,000,000 | 240 min | 3.125 | 20,375,000 | 91.2617 | 174.9182 |
| 5 | 1,000,001-1,200,000 | 480 min | 1.5625 | 20,687,500 | 182.5234 | 357.4416 |
| 6 | 1,200,001-1,400,000 | 960 min | 0.78125 | 20,843,750 | 365.0468 | 722.4884 |
| 7 | 1,400,001-1,600,000 | 1,920 min | 0.390625 | 20,921,875 | 730.0935 | 1,452.5819 |
| 8 | 1,600,001-1,800,000 | 3,840 min | 0.1953125 | 20,960,937.5 | 1,460.1871 | 2,912.7690 |
| 9 | 1,800,001-2,000,000 | 7,680 min | 0.09765625 | 20,980,468.75 | 2,920.3742 | 5,833.1432 |

The first claim of epoch 1 is claim 200,001: the reward changes once mineCount
has reached 200,000. Halving follows claims, not block height or calendar dates.

| Constant active addresses | First halving, years | Above 99% of cap (end epoch 6), years | Above 99.9% (end epoch 9), years |
|---|---:|---:|---:|
| 1 | 3.8026 | 722.4884 | 5,833.1432 |
| 3 | 1.2675 | 240.8295 | 1,944.3811 |
| 10 | 0.3803 | 72.2488 | 583.3143 |
| 100 | 0.0380 (about 13.89 days) | 7.2249 | 58.3314 |

For one address, the duration of epoch e is 200,000 * cooldownMinutes(e).
For e >= 1, cooldownMinutes(e) = 30 * 2^(e-1); epoch 0 uses 10.
Cumulative minutes through epoch e = 200,000 * [10 + 30 * (2^e - 1)].
Divide minutes by 525,960 (365.25 days/year), and then by active address count.

## Will exactly 21 million ever be minted?

Not under the current contract. It uses integer token-wei rewards
`(50 * 10^18) >> epoch`, and returns zero for epoch >= 64.

- Epoch 63 still pays 5 token wei per claim.
- Completing epochs 0-63 takes 12,800,000 claims.
- Total supply at that point is **20,999,999.9999999999942 ZBTC**.
- The cap difference is **0.0000000000058 ZBTC**, or 5,800,000 token wei.
- Further mining reverts because reward is zero, even though a tiny reserve
  remainder is still reported. The 21-million number is an upper bound.

With the proposed uncapped doubling, completing all positive-reward epochs takes
approximately **1.052176 * 10^20 years for one continuously claiming address**.
For 100 such addresses, approximately 1.052176 * 10^18 years. These enormous
tail times make perpetual doubling impractical as a human mining schedule.
For comparison, a constant 10-minute cooldown would take approximately
243.3645 years for one address to complete 64 epochs, or 2.4336 years for 100
addresses under the same idealized rate assumptions. Neither reaches the exact cap.

## Trade-offs and recommendation

- Longer cooldowns reduce each address's reward rate and transaction frequency.
  They do not create demand, guarantee a price, stop bots, or preserve pool USDC.
- Doubling forever creates astronomical waiting times at later epochs; consider
  a maximum cooldown before committing to a long-term policy.
- Keeping epoch 0 at 10 minutes leaves today's farming incentives unchanged.
  Waiting for the first halving is not an immediate mitigation.
- Manual owner changes introduce timing/availability risk and central control.
  Communicate any actual change before users act.
- Frontend-only delays are bypassable and should not be presented as protocol
  enforcement. Both miner pages use the contract's actual remaining cooldown.
- Reward sales into a low-liquidity pool can move prices sharply. Spot-price
  estimates are not guaranteed proceeds or mining income.
- Do not add liquidity solely to support automatic reward sales. Review demand
  and sustainable emissions before making an owner or LP transaction.

## Reproduce

From the miner repository:

```sh
node scripts/mining-emissions.js
npm test
```

The calculator uses BigInt for exact supply and cooldown arithmetic. Displayed
years use approximate floating-point values. It never accesses keys, RPC or sends
transactions. The proposal is not an executable owner-update script.
