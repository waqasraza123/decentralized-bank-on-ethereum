// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./StakingPoolStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

abstract contract PoolManagement is StakingPoolStorage, Ownable, ReentrancyGuard {
    event PoolCreated(uint256 poolId, uint256 rewardRate, uint256 externalPoolId);

    function createPool(uint256 _rewardRate, uint256 externalPoolId) 
        external 
        onlyOwner 
        returns (uint256) 
    {
        require(_rewardRate > 0, "Reward rate must be greater than 0");
        poolCount++;
        pools[poolCount] = Pool({
            rewardRate: _rewardRate,
            totalStaked: 0,
            totalRewardsPaid: 0
        });

        emit PoolCreated(poolCount, _rewardRate, externalPoolId);
        return poolCount;
    }
}