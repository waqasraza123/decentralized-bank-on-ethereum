// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PolicyControlledWallet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    bytes32 private constant WITHDRAWAL_AUTHORIZATION_TYPEHASH =
        keccak256(
            "WithdrawalAuthorization(bytes32 intentId,address asset,address to,uint256 amount,uint256 authorizationNonce,uint256 authorizationDeadline)"
        );

    bytes32 private immutable hashedName;
    bytes32 private immutable hashedVersion;
    address public policySigner;
    address public authorizedExecutor;
    uint256 public nextNonce;

    event PolicySignerUpdated(address indexed previousPolicySigner, address indexed newPolicySigner);
    event AuthorizedExecutorUpdated(
        address indexed previousAuthorizedExecutor,
        address indexed newAuthorizedExecutor
    );
    event WithdrawalExecuted(
        bytes32 indexed intentId,
        address indexed asset,
        address indexed to,
        uint256 amount,
        uint256 authorizationNonce,
        address executor
    );

    error InvalidPolicySigner();
    error InvalidAuthorizedExecutor();
    error InvalidDestination();
    error InvalidAmount();
    error InvalidAuthorizationNonce();
    error AuthorizationExpired();
    error InvalidAuthorizationSignature();
    error NativeTransferFailed();

    constructor(address initialOwner, address initialPolicySigner, address initialAuthorizedExecutor)
        Ownable(initialOwner)
    {
        if (initialPolicySigner == address(0)) {
            revert InvalidPolicySigner();
        }

        if (initialAuthorizedExecutor == address(0)) {
            revert InvalidAuthorizedExecutor();
        }

        hashedName = keccak256(bytes("StealthTrailsPolicyWallet"));
        hashedVersion = keccak256(bytes("1"));
        policySigner = initialPolicySigner;
        authorizedExecutor = initialAuthorizedExecutor;
    }

    modifier onlyAuthorizedExecutor() {
        if (msg.sender != authorizedExecutor) {
            revert InvalidAuthorizedExecutor();
        }

        _;
    }

    receive() external payable {}

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _domainSeparatorV4() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                hashedName,
                hashedVersion,
                block.chainid,
                address(this)
            )
        );
    }

    function setPolicySigner(address newPolicySigner) external onlyOwner {
        if (newPolicySigner == address(0)) {
            revert InvalidPolicySigner();
        }

        address previousPolicySigner = policySigner;
        policySigner = newPolicySigner;

        emit PolicySignerUpdated(previousPolicySigner, newPolicySigner);
    }

    function setAuthorizedExecutor(address newAuthorizedExecutor) external onlyOwner {
        if (newAuthorizedExecutor == address(0)) {
            revert InvalidAuthorizedExecutor();
        }

        address previousAuthorizedExecutor = authorizedExecutor;
        authorizedExecutor = newAuthorizedExecutor;

        emit AuthorizedExecutorUpdated(previousAuthorizedExecutor, newAuthorizedExecutor);
    }

    function executeAuthorizedTransfer(
        bytes32 intentId,
        address asset,
        address to,
        uint256 amount,
        uint256 authorizationNonce,
        uint256 authorizationDeadline,
        bytes calldata authorizationSignature
    ) external onlyAuthorizedExecutor nonReentrant {
        if (to == address(0)) {
            revert InvalidDestination();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (block.timestamp > authorizationDeadline) {
            revert AuthorizationExpired();
        }

        if (authorizationNonce != nextNonce) {
            revert InvalidAuthorizationNonce();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparatorV4(),
                keccak256(
                    abi.encode(
                        WITHDRAWAL_AUTHORIZATION_TYPEHASH,
                        intentId,
                        asset,
                        to,
                        amount,
                        authorizationNonce,
                        authorizationDeadline
                    )
                )
            )
        );

        address recoveredSigner = ECDSA.recover(digest, authorizationSignature);

        if (recoveredSigner != policySigner) {
            revert InvalidAuthorizationSignature();
        }

        unchecked {
            nextNonce += 1;
        }

        if (asset == address(0)) {
            (bool sent, ) = payable(to).call{value: amount}("");

            if (!sent) {
                revert NativeTransferFailed();
            }
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }

        emit WithdrawalExecuted(intentId, asset, to, amount, authorizationNonce, msg.sender);
    }
}
