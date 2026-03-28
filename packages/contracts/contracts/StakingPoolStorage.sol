// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

abstract contract StakingPoolStorage {
    struct Pool {
        uint256 rewardRate;
        uint256 totalStaked;
        uint256 totalRewardsPaid;
    }

    struct Staker {
        uint256 amountStaked;
        uint256 rewardDebt;
        uint256 lastStakeTime;
    }

    mapping(uint256 => Pool) public pools;
    mapping(address => mapping(uint256 => Staker)) public stakers;

    uint256 public poolCount;
}
