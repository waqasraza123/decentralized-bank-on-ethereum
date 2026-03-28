import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import hre from 'hardhat';

describe("StakingPool", function () {
  let stakingPool: any;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    const StakingPoolFactory = await hre.ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPoolFactory.deploy();

    [owner, addr1] = await hre.ethers.getSigners();
  });

  it("should allow the owner to create a pool with valid parameters", async function () {
    const rewardRate = 10;
    const externalPoolId = 42;

    await stakingPool.createPool(rewardRate, externalPoolId);
    const pool = await stakingPool.pools(1);

    expect(pool.rewardRate).to.equal(hre.ethers.parseUnits("10", 0));
    expect(pool.totalStaked).to.equal(hre.ethers.parseUnits("0", 18));
    expect(pool.totalRewardsPaid).to.equal(hre.ethers.parseUnits("0", 18));
  });

  it("should revert if rewardRate is 0", async function () {
    const rewardRate = 0; // invalid reward rate
    const externalPoolId = 42;

    try {
      await stakingPool.createPool(rewardRate, externalPoolId);
      expect.fail("Expected revert not received");
    } catch (error) {
      console.log(error.message);
      expect(error.message).to.include("Reward rate must be greater than 0");
    }
  });

  it("should revert if rewardRate is negative", async function () {
    const rewardRate = -1; // invalid negative reward rate
    const externalPoolId = 42;
  
    try {
      await stakingPool.createPool(rewardRate, externalPoolId);
      expect.fail("Expected revert not received");
    } catch (error) {
      expect(error.message).to.include("value out-of-bounds");
    }
  });

  it("should increment poolCount when a new pool is created", async function () {
    const rewardRate1 = 10;
    const rewardRate2 = 20;
    const externalPoolId1 = 42;
    const externalPoolId2 = 43;

    await stakingPool.createPool(rewardRate1, externalPoolId1);
    const poolCountAfterFirst = await stakingPool.poolCount();

    await stakingPool.createPool(rewardRate2, externalPoolId2);
    const poolCountAfterSecond = await stakingPool.poolCount();

    expect(poolCountAfterFirst).to.equal(hre.ethers.parseUnits("1", 0));
    expect(poolCountAfterSecond).to.equal(hre.ethers.parseUnits("2", 0));
  });

  it("should allow creating multiple pools with different reward rates", async function () {
    const rewardRate1 = 10;
    const rewardRate2 = 20;
    const externalPoolId1 = 42;
    const externalPoolId2 = 43;

    await stakingPool.createPool(rewardRate1, externalPoolId1);
    const pool1 = await stakingPool.pools(1);
    expect(pool1.rewardRate).to.equal(hre.ethers.parseUnits("10", 0));

    await stakingPool.createPool(rewardRate2, externalPoolId2);
    const pool2 = await stakingPool.pools(2);
    expect(pool2.rewardRate).to.equal(hre.ethers.parseUnits("20", 0));
  });
});
