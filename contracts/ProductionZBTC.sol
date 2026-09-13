// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProductionZBTC
 * @notice Deflationary mining token inspired by Bitcoin's halving schedule.
 * - Total Max Supply: 21,000,000 ZBTC
 * - Founder Pre-mine: 1,000,000 ZBTC (minted at deployment)
 * - Mineable Reserve: 20,000,000 ZBTC
 * - Halving Schedule:
 *     Epoch 0: 50 ZBTC per mine (200,000 mines = 10,000,000 ZBTC)
 *     Epoch 1: 25 ZBTC per mine (200,000 mines = 5,000,000 ZBTC)
 *     Epoch 2: 12.5 ZBTC per mine (200,000 mines = 2,500,000 ZBTC)
 *     ...sum across all epochs converges smoothly to the full 20,000,000 ZBTC pool.
 * - Anti-spam rate limiting: Cooldown per miner address (e.g. 10 minutes)
 */
contract ProductionZBTC is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY_CAP = 21_000_000 * 1e18;
    uint256 public constant FOUNDER_SUPPLY   = 1_000_000 * 1e18;
    uint256 public constant MINEABLE_SUPPLY  = 20_000_000 * 1e18;

    // Initial reward = 50 ZBTC
    uint256 public constant INITIAL_REWARD = 50 * 1e18;

    // Each epoch consists of 200,000 valid mines before reward cuts in half
    uint256 public constant MINES_PER_EPOCH = 200_000;

    // Minimum cooldown time between mines per address (default 10 minutes)
    uint256 public miningCooldown = 10 minutes;

    uint256 public totalMinedSupply;
    uint256 public mineCount;

    mapping(address => uint256) public lastMinedTimestamp;

    event Mined(address indexed miner, uint256 reward, uint256 epoch, uint256 mineCount);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    constructor(address founder_) ERC20("ZBTC Production", "ZBTC") Ownable(founder_) {
        require(founder_ != address(0), "Founder cannot be zero address");
        _mint(founder_, FOUNDER_SUPPLY);
    }

    /**
     * @notice Returns the current mining reward based on total mine count epoch.
     */
    function currentReward() public view returns (uint256) {
        uint256 epoch = mineCount / MINES_PER_EPOCH;
        if (epoch >= 64) {
            return 0; // Prevent overflow or zero-shift edge case
        }
        uint256 reward = INITIAL_REWARD >> epoch;
        
        // Ensure reward never exceeds the remaining pool
        uint256 remaining = remainingMineableSupply();
        if (reward > remaining) {
            reward = remaining;
        }
        return reward;
    }

    /**
     * @notice Remaining tokens available in the mineable reserve pool.
     */
    function remainingMineableSupply() public view returns (uint256) {
        if (totalMinedSupply >= MINEABLE_SUPPLY) {
            return 0;
        }
        return MINEABLE_SUPPLY - totalMinedSupply;
    }

    /**
     * @notice Current halving epoch (0 = 50 ZBTC, 1 = 25 ZBTC, etc.)
     */
    function currentEpoch() public view returns (uint256) {
        return mineCount / MINES_PER_EPOCH;
    }

    /**
     * @notice Time remaining in seconds before an address can mine again.
     */
    function cooldownRemaining(address miner) public view returns (uint256) {
        uint256 nextEligible = lastMinedTimestamp[miner] + miningCooldown;
        if (block.timestamp >= nextEligible) {
            return 0;
        }
        return nextEligible - block.timestamp;
    }

    /**
     * @notice Mine ZBTC tokens.
     */
    function mine() external returns (uint256 reward) {
        require(cooldownRemaining(msg.sender) == 0, "Mining cooldown in effect");

        reward = currentReward();
        require(reward > 0, "Mining pool fully exhausted");
        require(totalSupply() + reward <= TOTAL_SUPPLY_CAP, "Cap exceeded");

        lastMinedTimestamp[msg.sender] = block.timestamp;
        mineCount += 1;
        totalMinedSupply += reward;

        _mint(msg.sender, reward);

        emit Mined(msg.sender, reward, currentEpoch(), mineCount);
    }

    /**
     * @notice Owner can update cooldown if network speed/conditions change.
     */
    function setMiningCooldown(uint256 newCooldown) external onlyOwner {
        uint256 old = miningCooldown;
        miningCooldown = newCooldown;
        emit CooldownUpdated(old, newCooldown);
    }
}
