// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./StakingPoolStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

abstract contract StakingOperations is StakingPoolStorage, ReentrancyGuard {
    event Deposited(address indexed user, uint256 poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 poolId, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 poolId, uint256 reward);

    function deposit(uint256 poolId, uint256 amount) external payable {
        require(poolId > 0 && poolId <= poolCount, "Invalid pool ID");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Sent ETH does not match specified amount");

        Pool storage pool = pools[poolId];
        Staker storage staker = stakers[msg.sender][poolId];

        if (staker.amountStaked > 0) {
            uint256 pendingReward = calculateReward(msg.sender, poolId);
            staker.rewardDebt += pendingReward;
        }

        staker.amountStaked += amount;
        staker.lastStakeTime = block.timestamp;
        pool.totalStaked += amount;

        emit Deposited(msg.sender, poolId, amount);
    }

    function withdraw(uint256 poolId, uint256 _amount) external nonReentrant {
        require(poolId > 0 && poolId <= poolCount, "Invalid pool ID");
        require(_amount > 0, "Withdrawal amount must be greater than zero");

        Pool storage pool = pools[poolId];
        Staker storage staker = stakers[msg.sender][poolId];

        require(staker.amountStaked >= _amount, "Insufficient staked balance");

        uint256 pendingReward = calculateReward(msg.sender, poolId);
        staker.rewardDebt += pendingReward;

        staker.amountStaked -= _amount;
        pool.totalStaked -= _amount;

        uint256 totalReward = pendingReward + staker.rewardDebt;
        staker.rewardDebt = 0;

        (bool sentAmount, ) = payable(msg.sender).call{value: _amount}("");
        require(sentAmount, "Failed to send withdrawal amount");

        if (totalReward > 0) {
            (bool sentReward, ) = payable(msg.sender).call{value: totalReward}("");
            require(sentReward, "Failed to send reward amount");
        }

        emit Withdrawn(msg.sender, poolId, _amount, totalReward);
    }

    function claimReward(uint256 poolId) external nonReentrant {
        require(poolId > 0 && poolId <= poolCount, "Invalid pool ID");

        Staker storage staker = stakers[msg.sender][poolId];

        uint256 pendingReward = calculateReward(msg.sender, poolId);
        staker.rewardDebt += pendingReward;

        require(staker.rewardDebt > 0, "No rewards to claim");

        uint256 rewardToClaim = staker.rewardDebt;
        staker.rewardDebt = 0;

        (bool success, ) = payable(msg.sender).call{value: rewardToClaim}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(msg.sender, poolId, rewardToClaim);
    }

    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        require(poolId > 0 && poolId <= poolCount, "Invalid pool ID");

        Staker storage staker = stakers[msg.sender][poolId];
        uint256 amountStaked = staker.amountStaked;

        require(amountStaked > 0, "No funds to withdraw");

        staker.amountStaked = 0;
        staker.rewardDebt = 0;

        Pool storage pool = pools[poolId];
        pool.totalStaked -= amountStaked;

        (bool success, ) = payable(msg.sender).call{value: amountStaked}("");
        require(success, "Emergency withdrawal failed");

        emit Withdrawn(msg.sender, poolId, amountStaked, 0);
    }

    function calculateReward(address _user, uint256 poolId) internal view returns (uint256) {
        Staker storage staker = stakers[_user][poolId];
        uint256 timeStaked = block.timestamp - staker.lastStakeTime;

        uint256 reward = (staker.amountStaked * pools[poolId].rewardRate * timeStaked) / (365 days * 100);
        return reward;
    }
}