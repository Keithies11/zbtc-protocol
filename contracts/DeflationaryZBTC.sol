// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DeflationaryZBTC is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 21_000_000 * 1e18;
    uint256 public constant FOUNDER_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant MINEABLE_SUPPLY = 20_000_000 * 1e18;
    uint256 public constant INITIAL_REWARD = 50 * 1e18;
    uint256 public constant HALVING_INTERVAL = 2;

    uint256 public mineableSupply;
    uint256 public mineCount;

    constructor(address founder_) ERC20("Deflationary ZBTC", "ZBTC") {
        require(founder_ != address(0), "Founder cannot be zero");
        _mint(founder_, FOUNDER_SUPPLY);
        mineableSupply = MINEABLE_SUPPLY;
    }

    function currentReward() public view returns (uint256) {
        uint256 halvings = (mineCount + 1) / HALVING_INTERVAL;
        return INITIAL_REWARD >> halvings;
    }

    function mine() external returns (uint256 reward) {
        reward = currentReward();
        require(reward > 0, "Reward exhausted");
        require(totalSupply() + reward <= TOTAL_SUPPLY, "Total supply cap reached");
        require(mineableSupply >= reward, "Mineable pool exhausted");

        mineCount += 1;
        mineableSupply -= reward;
        _mint(msg.sender, reward);
    }
}
