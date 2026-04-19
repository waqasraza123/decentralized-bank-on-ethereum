// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LoanBookV1 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanState {
        draft,
        awaiting_collateral,
        awaiting_funding,
        active,
        grace_period,
        defaulted,
        liquidation_review,
        liquidating,
        closed
    }

    struct Agreement {
        address borrower;
        address borrowAsset;
        address collateralAsset;
        address payable treasuryReceiver;
        uint256 principalAmount;
        uint256 collateralAmount;
        uint256 serviceFeeAmount;
        uint256 recoveredAmount;
        uint256 shortfallAmount;
        uint256 nextDueAt;
        LoanState state;
        bool collateralLocked;
        bool initialized;
    }

    address public treasurySafe;
    address public emergencySafe;
    mapping(bytes32 => Agreement) private agreements;

    event TreasurySafeUpdated(address indexed previousTreasurySafe, address indexed nextTreasurySafe);
    event EmergencySafeUpdated(address indexed previousEmergencySafe, address indexed nextEmergencySafe);
    event AgreementCreated(
        bytes32 indexed agreementId,
        address indexed borrower,
        address indexed treasuryReceiver,
        uint256 principalAmount,
        uint256 collateralAmount,
        uint256 serviceFeeAmount
    );
    event CollateralLocked(bytes32 indexed agreementId, uint256 amount);
    event AgreementFunded(bytes32 indexed agreementId, uint256 firstDueAt);
    event RepaymentRecorded(bytes32 indexed agreementId, uint256 amount);
    event GracePeriodStarted(bytes32 indexed agreementId, uint256 gracePeriodEndsAt);
    event AgreementDefaulted(bytes32 indexed agreementId);
    event LiquidationReviewStarted(bytes32 indexed agreementId);
    event LiquidationApproved(bytes32 indexed agreementId);
    event LiquidationExecuted(
        bytes32 indexed agreementId,
        uint256 recoveredAmount,
        uint256 shortfallAmount
    );
    event CollateralReleased(bytes32 indexed agreementId, uint256 amount);
    event AgreementClosed(bytes32 indexed agreementId);
    event EmergencyPause(address indexed triggeredBy);
    event EmergencyResume(address indexed triggeredBy);

    modifier onlyTreasurySafeOrOwner() {
        require(
            msg.sender == treasurySafe || msg.sender == owner(),
            "Treasury authority required"
        );
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

    function createAgreement(
        bytes32 agreementId,
        address borrower,
        address borrowAsset,
        address collateralAsset,
        address payable treasuryReceiver,
        uint256 principalAmount,
        uint256 collateralAmount,
        uint256 serviceFeeAmount
    ) external onlyOwner whenNotPaused {
        require(agreementId != bytes32(0), "Agreement id is required");
        require(!agreements[agreementId].initialized, "Agreement already exists");
        require(borrower != address(0), "Borrower is required");
        require(treasuryReceiver != address(0), "Treasury receiver is required");
        require(principalAmount > 0, "Principal amount must be positive");
        require(collateralAmount > 0, "Collateral amount must be positive");

        agreements[agreementId] = Agreement({
            borrower: borrower,
            borrowAsset: borrowAsset,
            collateralAsset: collateralAsset,
            treasuryReceiver: treasuryReceiver,
            principalAmount: principalAmount,
            collateralAmount: collateralAmount,
            serviceFeeAmount: serviceFeeAmount,
            recoveredAmount: 0,
            shortfallAmount: 0,
            nextDueAt: 0,
            state: LoanState.awaiting_collateral,
            collateralLocked: false,
            initialized: true
        });

        emit AgreementCreated(
            agreementId,
            borrower,
            treasuryReceiver,
            principalAmount,
            collateralAmount,
            serviceFeeAmount
        );
    }

    function lockCollateral(bytes32 agreementId, uint256 amount)
        external
        payable
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.awaiting_collateral, "Agreement not awaiting collateral");
        require(!agreement.collateralLocked, "Collateral already locked");
        require(amount == agreement.collateralAmount, "Collateral amount mismatch");

        if (agreement.collateralAsset == address(0)) {
            require(msg.value == amount, "ETH collateral amount mismatch");
        } else {
            require(msg.value == 0, "Unexpected ETH collateral");
            IERC20(agreement.collateralAsset).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        agreement.collateralLocked = true;
        agreement.state = LoanState.awaiting_funding;

        emit CollateralLocked(agreementId, amount);
    }

    function fundAgreement(bytes32 agreementId, uint256 firstDueAt)
        external
        payable
        onlyTreasurySafeOrOwner
        whenNotPaused
        nonReentrant
    {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.awaiting_funding, "Agreement not awaiting funding");
        require(agreement.collateralLocked, "Collateral must be locked");
        require(firstDueAt > block.timestamp, "First due date must be in the future");

        if (agreement.borrowAsset == address(0)) {
            require(msg.value == agreement.principalAmount, "ETH funding amount mismatch");
            (bool sent, ) = payable(agreement.borrower).call{value: agreement.principalAmount}("");
            require(sent, "ETH funding transfer failed");
        } else {
            require(msg.value == 0, "Unexpected ETH funding");
            IERC20(agreement.borrowAsset).safeTransferFrom(
                msg.sender,
                agreement.borrower,
                agreement.principalAmount
            );
        }

        agreement.state = LoanState.active;
        agreement.nextDueAt = firstDueAt;

        emit AgreementFunded(agreementId, firstDueAt);
    }

    function recordRepayment(bytes32 agreementId, uint256 amount)
        external
        payable
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.active || agreement.state == LoanState.grace_period, "Agreement is not repayable");
        require(amount > 0, "Repayment amount must be positive");

        if (agreement.borrowAsset == address(0)) {
            require(msg.value == amount, "ETH repayment amount mismatch");
            (bool sent, ) = agreement.treasuryReceiver.call{value: amount}("");
            require(sent, "ETH repayment transfer failed");
        } else {
            require(msg.value == 0, "Unexpected ETH repayment");
            IERC20(agreement.borrowAsset).safeTransferFrom(
                msg.sender,
                agreement.treasuryReceiver,
                amount
            );
        }

        emit RepaymentRecorded(agreementId, amount);
    }

    function startGracePeriod(bytes32 agreementId, uint256 gracePeriodEndsAt)
        external
        onlyOwner
        whenNotPaused
    {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.active, "Agreement is not active");
        require(gracePeriodEndsAt > block.timestamp, "Grace period must end in the future");

        agreement.state = LoanState.grace_period;
        agreement.nextDueAt = gracePeriodEndsAt;

        emit GracePeriodStarted(agreementId, gracePeriodEndsAt);
    }

    function markDefaulted(bytes32 agreementId) external onlyOwner whenNotPaused {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(
            agreement.state == LoanState.active || agreement.state == LoanState.grace_period,
            "Agreement cannot default"
        );

        agreement.state = LoanState.defaulted;
        emit AgreementDefaulted(agreementId);
    }

    function startLiquidationReview(bytes32 agreementId) external onlyOwner whenNotPaused {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.defaulted, "Agreement must be defaulted");

        agreement.state = LoanState.liquidation_review;
        emit LiquidationReviewStarted(agreementId);
    }

    function approveLiquidation(bytes32 agreementId) external onlyOwner whenNotPaused {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.liquidation_review, "Agreement not under liquidation review");

        agreement.state = LoanState.liquidating;
        emit LiquidationApproved(agreementId);
    }

    function executeLiquidation(
        bytes32 agreementId,
        uint256 recoveredAmount,
        uint256 shortfallAmount
    ) external onlyOwner whenNotPaused {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.state == LoanState.liquidating, "Agreement is not liquidating");

        agreement.recoveredAmount = recoveredAmount;
        agreement.shortfallAmount = shortfallAmount;
        agreement.state = LoanState.closed;

        emit LiquidationExecuted(agreementId, recoveredAmount, shortfallAmount);
        emit AgreementClosed(agreementId);
    }

    function releaseCollateral(bytes32 agreementId)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        Agreement storage agreement = _requireAgreement(agreementId);
        require(agreement.collateralLocked, "Collateral is not locked");
        require(
            agreement.state == LoanState.active ||
                agreement.state == LoanState.grace_period ||
                agreement.state == LoanState.closed,
            "Collateral cannot be released"
        );

        agreement.collateralLocked = false;
        agreement.state = LoanState.closed;

        if (agreement.collateralAsset == address(0)) {
            (bool sent, ) = payable(agreement.borrower).call{value: agreement.collateralAmount}("");
            require(sent, "ETH collateral release failed");
        } else {
            IERC20(agreement.collateralAsset).safeTransfer(
                agreement.borrower,
                agreement.collateralAmount
            );
        }

        emit CollateralReleased(agreementId, agreement.collateralAmount);
        emit AgreementClosed(agreementId);
    }

    function closeAgreement(bytes32 agreementId) external onlyOwner whenNotPaused {
        Agreement storage agreement = _requireAgreement(agreementId);
        agreement.state = LoanState.closed;
        emit AgreementClosed(agreementId);
    }

    function getAgreement(bytes32 agreementId)
        external
        view
        returns (
            address borrower,
            address borrowAsset,
            address collateralAsset,
            address treasuryReceiver,
            uint256 principalAmount,
            uint256 collateralAmount,
            uint256 serviceFeeAmount,
            uint256 recoveredAmount,
            uint256 shortfallAmount,
            uint256 nextDueAt,
            LoanState state,
            bool collateralLocked,
            bool initialized
        )
    {
        Agreement memory agreement = agreements[agreementId];
        return (
            agreement.borrower,
            agreement.borrowAsset,
            agreement.collateralAsset,
            agreement.treasuryReceiver,
            agreement.principalAmount,
            agreement.collateralAmount,
            agreement.serviceFeeAmount,
            agreement.recoveredAmount,
            agreement.shortfallAmount,
            agreement.nextDueAt,
            agreement.state,
            agreement.collateralLocked,
            agreement.initialized
        );
    }

    function _requireAgreement(bytes32 agreementId)
        internal
        view
        returns (Agreement storage)
    {
        require(agreementId != bytes32(0), "Agreement id is required");
        Agreement storage agreement = agreements[agreementId];
        require(agreement.initialized, "Agreement does not exist");
        return agreement;
    }

    receive() external payable {
        revert("Direct ETH transfer disabled");
    }
}
