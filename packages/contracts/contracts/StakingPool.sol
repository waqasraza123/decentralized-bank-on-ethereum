// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PoolManagement.sol";
import "./StakingOperations.sol";

contract StakingPool is PoolManagement, StakingOperations {
    constructor() Ownable(msg.sender) {
    }

    function ensureValidPool(uint256 poolId)
        internal
        view
        override(PoolManagement, StakingOperations)
    {
        PoolManagement.ensureValidPool(poolId);
    }

    function getStakedBalance(address _user, uint256 poolId) external view returns (uint256) {
        return stakers[_user][poolId].amountStaked;
    }

    function getPendingReward(address _user, uint256 poolId) external view returns (uint256) {
        Staker storage staker = stakers[_user][poolId];
        return staker.rewardDebt + calculateReward(_user, poolId);
    }

    function getTotalStaked(uint256 poolId) external view returns (uint256) {
        return pools[poolId].totalStaked;
    }

    function getPoolRewardReserve(uint256 poolId) external view returns (uint256) {
        ensureValidPool(poolId);
        return pools[poolId].rewardReserve;
    }

    function arePoolDepositsPaused(uint256 poolId) external view returns (bool) {
        ensureValidPool(poolId);
        return pools[poolId].depositsPaused;
    }

    receive() external payable {
        revert("Direct ETH transfer disabled");
    }

    fallback() external payable {
        revert("Unsupported call");
    }
}
