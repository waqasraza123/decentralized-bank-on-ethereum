// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingV1 is Ownable, Pausable, ReentrancyGuard {
    struct Position {
        address beneficiary;
        uint256 stakedAmount;
        uint256 accruedRewardAmount;
        uint256 claimedRewardAmount;
        bool initialized;
    }

    address public treasurySafe;
    address public emergencySafe;
    uint256 public totalStaked;
    uint256 public rewardReserve;

    mapping(bytes32 => Position) private positions;

    event TreasurySafeUpdated(address indexed previousTreasurySafe, address indexed nextTreasurySafe);
    event EmergencySafeUpdated(address indexed previousEmergencySafe, address indexed nextEmergencySafe);
    event PositionBeneficiaryBound(bytes32 indexed positionId, address indexed beneficiary);
    event PositionDeposited(bytes32 indexed positionId, address indexed beneficiary, uint256 amount);
    event PositionWithdrawn(bytes32 indexed positionId, address indexed recipient, uint256 amount);
    event RewardsFunded(address indexed treasurySafe, uint256 amount);
    event RewardAccrued(bytes32 indexed positionId, uint256 amount);
    event RewardClaimed(bytes32 indexed positionId, address indexed recipient, uint256 amount);
    event EmergencyPause(address indexed triggeredBy);
    event EmergencyResume(address indexed triggeredBy);

    modifier onlyTreasurySafe() {
        require(msg.sender == treasurySafe, "Treasury safe required");
        _;
    }

    modifier onlyEmergencySafeOrOwner() {
        require(
            msg.sender == emergencySafe || msg.sender == owner(),
            "Emergency authority required"
        );
        _;
    }

    constructor(
        address governanceSafe,
        address treasurySafe_,
        address emergencySafe_
    ) Ownable(governanceSafe) {
        require(governanceSafe != address(0), "Governance safe is required");
        require(treasurySafe_ != address(0), "Treasury safe is required");
        require(emergencySafe_ != address(0), "Emergency safe is required");

        treasurySafe = treasurySafe_;
        emergencySafe = emergencySafe_;
    }

    function setTreasurySafe(address nextTreasurySafe) external onlyOwner {
        require(nextTreasurySafe != address(0), "Treasury safe is required");
        emit TreasurySafeUpdated(treasurySafe, nextTreasurySafe);
        treasurySafe = nextTreasurySafe;
    }

    function setEmergencySafe(address nextEmergencySafe) external onlyOwner {
        require(nextEmergencySafe != address(0), "Emergency safe is required");
        emit EmergencySafeUpdated(emergencySafe, nextEmergencySafe);
        emergencySafe = nextEmergencySafe;
    }

    function pause() external onlyEmergencySafeOrOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyEmergencySafeOrOwner {
        _unpause();
        emit EmergencyResume(msg.sender);
    }

    function bindPositionBeneficiary(bytes32 positionId, address beneficiary) external onlyOwner {
        require(positionId != bytes32(0), "Position id is required");
        require(beneficiary != address(0), "Beneficiary is required");

        Position storage position = positions[positionId];

        if (!position.initialized) {
            position.initialized = true;
        } else {
            require(position.beneficiary == beneficiary, "Beneficiary already bound");
        }

        position.beneficiary = beneficiary;
        emit PositionBeneficiaryBound(positionId, beneficiary);
    }

    function recordDeposit(bytes32 positionId, address beneficiary)
        external
        payable
        onlyOwner
        whenNotPaused
    {
        require(msg.value > 0, "Deposit amount must be positive");

        Position storage position = _requireOrCreatePosition(positionId, beneficiary);
        position.stakedAmount += msg.value;
        totalStaked += msg.value;

        emit PositionDeposited(positionId, position.beneficiary, msg.value);
    }

    function recordWithdrawal(
        bytes32 positionId,
        uint256 amount,
        address payable recipient
    ) external onlyOwner whenNotPaused nonReentrant {
        require(recipient != address(0), "Recipient is required");
        require(amount > 0, "Withdrawal amount must be positive");

        Position storage position = _requireExistingPosition(positionId);
        require(position.stakedAmount >= amount, "Insufficient staked amount");

        position.stakedAmount -= amount;
        totalStaked -= amount;

        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Withdrawal transfer failed");

        emit PositionWithdrawn(positionId, recipient, amount);
    }

    function fundRewards() external payable onlyTreasurySafe {
        require(msg.value > 0, "Reward funding amount must be positive");
        rewardReserve += msg.value;
        emit RewardsFunded(msg.sender, msg.value);
    }

    function recordRewardAccrual(bytes32 positionId, uint256 amount)
        external
        onlyOwner
        whenNotPaused
    {
        require(amount > 0, "Reward amount must be positive");
        require(rewardReserve >= amount, "Insufficient reward reserve");

        Position storage position = _requireExistingPosition(positionId);
        position.accruedRewardAmount += amount;
        rewardReserve -= amount;

        emit RewardAccrued(positionId, amount);
    }

    function claimReward(
        bytes32 positionId,
        address payable recipient
    ) external onlyOwner whenNotPaused nonReentrant {
        require(recipient != address(0), "Recipient is required");

        Position storage position = _requireExistingPosition(positionId);
        uint256 rewardAmount = position.accruedRewardAmount;
        require(rewardAmount > 0, "No accrued reward");

        position.accruedRewardAmount = 0;
        position.claimedRewardAmount += rewardAmount;

        (bool sent, ) = recipient.call{value: rewardAmount}("");
        require(sent, "Reward transfer failed");

        emit RewardClaimed(positionId, recipient, rewardAmount);
    }

    function getPosition(bytes32 positionId)
        external
        view
        returns (
            address beneficiary,
            uint256 stakedAmount,
            uint256 accruedRewardAmount,
            uint256 claimedRewardAmount,
            bool initialized
        )
    {
        Position memory position = positions[positionId];
        return (
            position.beneficiary,
            position.stakedAmount,
            position.accruedRewardAmount,
            position.claimedRewardAmount,
            position.initialized
        );
    }

    function _requireOrCreatePosition(
        bytes32 positionId,
        address beneficiary
    ) internal returns (Position storage) {
        require(positionId != bytes32(0), "Position id is required");
        require(beneficiary != address(0), "Beneficiary is required");

        Position storage position = positions[positionId];

        if (!position.initialized) {
            position.initialized = true;
            position.beneficiary = beneficiary;
            emit PositionBeneficiaryBound(positionId, beneficiary);
            return position;
        }

        require(position.beneficiary == beneficiary, "Beneficiary mismatch");
        return position;
    }

    function _requireExistingPosition(bytes32 positionId)
        internal
        view
        returns (Position storage)
    {
        require(positionId != bytes32(0), "Position id is required");
        Position storage position = positions[positionId];
        require(position.initialized, "Position does not exist");
        return position;
    }

    receive() external payable {
        revert("Direct ETH transfer disabled");
    }
}
