// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ProductionZBTCv2
 * @author ZYN Protocol Team
 * @notice Upgraded Deflationary Mining ERC-20 token incorporating SolidityScan audit remediations:
 * - Two-step ownership transfers (Ownable2Step) for multi-step admin protection.
 * - Locked pragma version (0.8.20).
 * - Full NatSpec documentation and indexed event parameters.
 * - Gas-optimized conditionals and state variable caching.
 *
 * Tokenomics:
 * - Total Max Supply: 21,000,000 ZBTC
 * - Founder Pre-mine: 1,000,000 ZBTC (minted at deployment to founder)
 * - Mineable Reserve: 20,000,000 ZBTC (emitted via proof-of-transaction mine() calls)
 * - Halving Schedule:
 *     Epoch 0: 50 ZBTC per mine (200,000 mines = 10,000,000 ZBTC)
 *     Epoch 1: 25 ZBTC per mine (200,000 mines = 5,000,000 ZBTC)
 *     Epoch 2: 12.5 ZBTC per mine (200,000 mines = 2,500,000 ZBTC)
 */
contract ProductionZBTCv2 is ERC20, Ownable2Step {
    uint256 public constant TOTAL_SUPPLY_CAP = 21_000_000 * 1e18;
    uint256 public constant FOUNDER_SUPPLY   = 1_000_000 * 1e18;
    uint256 public constant MINEABLE_SUPPLY  = 20_000_000 * 1e18;

    /// @notice Initial mining reward per valid block claim (50 ZBTC).
    uint256 public constant INITIAL_REWARD = 50 * 1e18;

    /// @notice Number of valid mines per halving epoch.
    uint256 public constant MINES_PER_EPOCH = 200_000;

    /// @notice Minimum cooldown duration between claims per miner address (default 10 minutes).
    uint256 public miningCooldown = 10 minutes;

    /// @notice Cumulative total ZBTC tokens minted from the mineable pool.
    uint256 public totalMinedSupply;

    /// @notice Cumulative total number of valid mining claims executed.
    uint256 public mineCount;

    /// @notice Mapping of miner address => timestamp of their last valid claim.
    mapping(address => uint256) public lastMinedTimestamp;

    /// @notice Emitted when a miner successfully claims a ZBTC mining reward.
    /// @param miner Address receiving the mining reward.
    /// @param reward Amount of ZBTC tokens minted for this claim.
    /// @param epoch Current halving epoch at the time of claim.
    /// @param mineCount Global cumulative mine count after this claim.
    event Mined(address indexed miner, uint256 reward, uint256 indexed epoch, uint256 mineCount);

    /// @notice Emitted when the contract owner updates the mining cooldown duration.
    /// @param oldCooldown Previous cooldown duration in seconds.
    /// @param newCooldown Updated cooldown duration in seconds.
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    /**
     * @notice Constructor initializes the token name, symbol, two-step owner, and founder pre-mine allocation.
     * @param founder_ Destination address receiving the 1,000,000 ZBTC founder allocation.
     */
    constructor(address founder_) ERC20("ZBTC Production v2", "ZBTC") Ownable(founder_) {
        require(founder_ != address(0), "Founder cannot be zero address");
        _mint(founder_, FOUNDER_SUPPLY);
    }

    /**
     * @notice Returns the current mining reward based on global mine count epoch.
     * @return Reward in 18-decimal ZBTC units for the current epoch.
     */
    function currentReward() public view returns (uint256) {
        uint256 epoch = mineCount / MINES_PER_EPOCH;
        if (epoch >= 64) {
            return 0;
        }
        uint256 reward = INITIAL_REWARD >> epoch;
        
        uint256 remaining = remainingMineableSupply();
        if (reward > remaining) {
            reward = remaining;
        }
        return reward;
    }

    /**
     * @notice Returns the remaining tokens available in the 20,000,000 ZBTC mineable reserve.
     * @return Remaining mineable supply in 18-decimal units.
     */
    function remainingMineableSupply() public view returns (uint256) {
        uint256 mined = totalMinedSupply;
        if (mined >= MINEABLE_SUPPLY) {
            return 0;
        }
        return MINEABLE_SUPPLY - mined;
    }

    /**
     * @notice Returns the current halving epoch index (0 = 50 ZBTC, 1 = 25 ZBTC, etc.).
     * @return Epoch index.
     */
    function currentEpoch() public view returns (uint256) {
        return mineCount / MINES_PER_EPOCH;
    }

    /**
     * @notice Time remaining in seconds before a specific miner address can mine again.
     * @param miner Address to check remaining cooldown for.
     * @return Seconds remaining until next eligible mine call (0 if eligible now).
     */
    function cooldownRemaining(address miner) public view returns (uint256) {
        uint256 nextEligible = lastMinedTimestamp[miner] + miningCooldown;
        uint256 currentTs = block.timestamp;
        if (currentTs >= nextEligible) {
            return 0;
        }
        return nextEligible - currentTs;
    }

    /**
     * @notice Executes an on-chain mining claim.
     * @return reward Amount of ZBTC tokens minted for this claim.
     */
    function mine() external returns (uint256 reward) {
        require(cooldownRemaining(msg.sender) == 0, "Mining cooldown in effect");

        reward = currentReward();
        require(reward != 0, "Mining pool fully exhausted");
        require(totalSupply() + reward <= TOTAL_SUPPLY_CAP, "Cap exceeded");

        uint256 currentMineCount = mineCount + 1;
        uint256 epoch = currentEpoch();

        lastMinedTimestamp[msg.sender] = block.timestamp;
        mineCount = currentMineCount;
        totalMinedSupply += reward;

        _mint(msg.sender, reward);

        emit Mined(msg.sender, reward, epoch, currentMineCount);
    }

    /**
     * @notice Updates the mining cooldown duration. Restricted to the contract owner.
     * @param newCooldown New cooldown duration in seconds.
     */
    function setMiningCooldown(uint256 newCooldown) external onlyOwner {
        uint256 old = miningCooldown;
        miningCooldown = newCooldown;
        emit CooldownUpdated(old, newCooldown);
    }
}
