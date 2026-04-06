// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./StakingPoolStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

abstract contract PoolManagement is StakingPoolStorage, Ownable, ReentrancyGuard {
    event PoolCreated(uint256 poolId, uint256 rewardRate, uint256 externalPoolId);
    event PoolRewardFunded(uint256 indexed poolId, uint256 amount, uint256 newRewardReserve);
    event PoolDepositPauseUpdated(uint256 indexed poolId, bool depositsPaused);

    function ensureValidPool(uint256 poolId) internal view virtual {
        require(poolId > 0 && poolId <= poolCount, "Invalid pool ID");
    }

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
            totalRewardsPaid: 0,
            rewardReserve: 0,
            depositsPaused: false
        });

        emit PoolCreated(poolCount, _rewardRate, externalPoolId);
        return poolCount;
    }

    function fundPoolRewards(uint256 poolId)
        external
        payable
        onlyOwner
        nonReentrant
    {
        ensureValidPool(poolId);
        require(msg.value > 0, "Funding amount must be greater than 0");

        Pool storage pool = pools[poolId];
        pool.rewardReserve += msg.value;

        emit PoolRewardFunded(poolId, msg.value, pool.rewardReserve);
    }

    function setPoolDepositPause(uint256 poolId, bool depositsPaused)
        external
        onlyOwner
    {
        ensureValidPool(poolId);

        pools[poolId].depositsPaused = depositsPaused;

        emit PoolDepositPauseUpdated(poolId, depositsPaused);
    }
}
