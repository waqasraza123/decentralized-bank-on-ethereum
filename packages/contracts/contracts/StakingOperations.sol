// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./StakingPoolStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

abstract contract StakingOperations is StakingPoolStorage, ReentrancyGuard {
    event Deposited(address indexed user, uint256 poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 poolId, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 poolId, uint256 reward);

    function ensureValidPool(uint256 poolId) internal view virtual;

    function checkpointReward(address user, uint256 poolId) internal returns (uint256) {
        Staker storage staker = stakers[user][poolId];
        uint256 pendingReward = calculateReward(user, poolId);

        if (pendingReward > 0) {
            staker.rewardDebt += pendingReward;
        }

        staker.lastStakeTime = block.timestamp;
        return pendingReward;
    }

    function deposit(uint256 poolId, uint256 amount) external payable {
        ensureValidPool(poolId);
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Sent ETH does not match specified amount");

        Pool storage pool = pools[poolId];
        require(!pool.depositsPaused, "Pool deposits are paused");

        Staker storage staker = stakers[msg.sender][poolId];
        if (staker.amountStaked > 0) {
            checkpointReward(msg.sender, poolId);
        } else {
            staker.lastStakeTime = block.timestamp;
        }

        staker.amountStaked += amount;
        pool.totalStaked += amount;

        emit Deposited(msg.sender, poolId, amount);
    }

    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        ensureValidPool(poolId);
        require(amount > 0, "Withdrawal amount must be greater than zero");

        Pool storage pool = pools[poolId];
        Staker storage staker = stakers[msg.sender][poolId];
        require(staker.amountStaked >= amount, "Insufficient staked balance");

        uint256 totalReward = staker.rewardDebt + calculateReward(msg.sender, poolId);
        require(pool.rewardReserve >= totalReward, "Insufficient funded rewards");

        staker.amountStaked -= amount;
        staker.rewardDebt = 0;
        staker.lastStakeTime = block.timestamp;
        pool.totalStaked -= amount;
        pool.rewardReserve -= totalReward;
        pool.totalRewardsPaid += totalReward;

        (bool sentAmount, ) = payable(msg.sender).call{value: amount}("");
        require(sentAmount, "Failed to send withdrawal amount");

        if (totalReward != 0) {
            (bool sentReward, ) = payable(msg.sender).call{value: totalReward}("");
            require(sentReward, "Failed to send reward amount");
        }

        emit Withdrawn(msg.sender, poolId, amount, totalReward);
    }

    function claimReward(uint256 poolId) external nonReentrant {
        ensureValidPool(poolId);

        Pool storage pool = pools[poolId];
        Staker storage staker = stakers[msg.sender][poolId];
        uint256 rewardToClaim = staker.rewardDebt + calculateReward(msg.sender, poolId);

        require(rewardToClaim > 0, "No rewards to claim");
        require(pool.rewardReserve >= rewardToClaim, "Insufficient funded rewards");

        staker.rewardDebt = 0;
        staker.lastStakeTime = block.timestamp;
        pool.rewardReserve -= rewardToClaim;
        pool.totalRewardsPaid += rewardToClaim;

        (bool success, ) = payable(msg.sender).call{value: rewardToClaim}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(msg.sender, poolId, rewardToClaim);
    }

    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        ensureValidPool(poolId);

        Staker storage staker = stakers[msg.sender][poolId];
        uint256 amountStaked = staker.amountStaked;
        require(amountStaked > 0, "No funds to withdraw");

        staker.amountStaked = 0;
        staker.rewardDebt = 0;
        staker.lastStakeTime = block.timestamp;

        Pool storage pool = pools[poolId];
        pool.totalStaked -= amountStaked;

        (bool success, ) = payable(msg.sender).call{value: amountStaked}("");
        require(success, "Emergency withdrawal failed");

        emit Withdrawn(msg.sender, poolId, amountStaked, 0);
    }

    function calculateReward(address user, uint256 poolId) internal view returns (uint256) {
        Staker storage staker = stakers[user][poolId];
        uint256 timeStaked = block.timestamp - staker.lastStakeTime;

        return (staker.amountStaked * pools[poolId].rewardRate * timeStaked) / (365 days * 100);
    }
}
