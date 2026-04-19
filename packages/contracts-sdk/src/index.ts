import { ethers } from "ethers";
import { readFileSync } from "node:fs";

export const STAKING_CONTRACT_ABI = [
  "function createPool(uint256 _rewardRate, uint256 externalPoolId) external",
  "function fundPoolRewards(uint256 poolId) external payable",
  "function setPoolDepositPause(uint256 poolId, bool depositsPaused) external",
  "function deposit(uint256 poolId, uint256 amount) external payable",
  "function withdraw(uint256 poolId, uint256 _amount) external",
  "function claimReward(uint256 poolId) external",
  "function emergencyWithdraw(uint256 poolId) external",
  "function getStakedBalance(address _user, uint256 poolId) external view returns (uint256)",
  "function getPendingReward(address _user, uint256 poolId) external view returns (uint256)",
  "function getTotalStaked(uint256 poolId) external view returns (uint256)",
  "function getPoolRewardReserve(uint256 poolId) external view returns (uint256)",
  "function arePoolDepositsPaused(uint256 poolId) external view returns (bool)"
] as const;

export const LOAN_BOOK_ABI = [
  "function createLoan(address borrower, address borrowAsset, address collateralAsset, uint256 principalAmount, uint256 collateralAmount, uint256 serviceFeeAmount, uint256 installmentAmount, uint256 installmentCount, uint256 termMonths, bool autopayEnabled) external returns (uint256)",
  "function lockCollateral(uint256 loanId, uint256 amount) external payable",
  "function fundLoan(uint256 loanId, uint256 firstDueAt) external payable",
  "function recordRepayment(uint256 loanId, uint256 amount) external payable",
  "function startGracePeriod(uint256 loanId, uint256 gracePeriodEndsAt) external",
  "function markDefaulted(uint256 loanId) external",
  "function startLiquidationReview(uint256 loanId) external",
  "function approveLiquidation(uint256 loanId) external",
  "function executeLiquidation(uint256 loanId, uint256 recoveredAmount, uint256 shortfallAmount) external",
  "function releaseCollateral(uint256 loanId) external",
  "function loans(uint256 loanId) external view returns (address borrower, address borrowAsset, address collateralAsset, uint256 principalAmount, uint256 collateralAmount, uint256 serviceFeeAmount, uint256 outstandingPrincipalAmount, uint256 outstandingServiceFeeAmount, uint256 installmentAmount, uint256 installmentCount, uint256 termMonths, uint256 nextDueAt, bool autopayEnabled, uint8 state, uint8 collateralState)"
] as const;

export const STAKING_EVENT_ABI = [
  "event PoolCreated(uint256 poolId, uint256 rewardRate, uint256 externalPoolId)",
  "event Deposited(address indexed user, uint256 poolId, uint256 amount)"
] as const;

export const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
] as const;

export const POLICY_CONTROLLED_WALLET_ABI = [
  "function policySigner() view returns (address)",
  "function authorizedExecutor() view returns (address)",
  "function nextNonce() view returns (uint256)",
  "function executeAuthorizedTransfer(bytes32 intentId,address asset,address to,uint256 amount,uint256 authorizationNonce,uint256 authorizationDeadline,bytes authorizationSignature) external",
  "event WithdrawalExecuted(bytes32 indexed intentId, address indexed asset, address indexed to, uint256 amount, uint256 authorizationNonce, address executor)"
] as const;

export const STAKING_V1_ABI = [
  "function bindPositionBeneficiary(bytes32 positionId, address beneficiary) external",
  "function recordDeposit(bytes32 positionId, address beneficiary) external payable",
  "function recordWithdrawal(bytes32 positionId, uint256 amount, address recipient) external",
  "function fundRewards() external payable",
  "function recordRewardAccrual(bytes32 positionId, uint256 amount) external",
  "function claimReward(bytes32 positionId, address recipient) external",
  "function getPosition(bytes32 positionId) external view returns (address beneficiary, uint256 stakedAmount, uint256 accruedRewardAmount, uint256 claimedRewardAmount, bool initialized)"
] as const;

export const LOAN_BOOK_V1_ABI = [
  "function createAgreement(bytes32 agreementId, address borrower, address borrowAsset, address collateralAsset, address treasuryReceiver, uint256 principalAmount, uint256 collateralAmount, uint256 serviceFeeAmount) external",
  "function lockCollateral(bytes32 agreementId, uint256 amount) external payable",
  "function fundAgreement(bytes32 agreementId, uint256 firstDueAt) external payable",
  "function recordRepayment(bytes32 agreementId, uint256 amount) external payable",
  "function startGracePeriod(bytes32 agreementId, uint256 gracePeriodEndsAt) external",
  "function markDefaulted(bytes32 agreementId) external",
  "function startLiquidationReview(bytes32 agreementId) external",
  "function approveLiquidation(bytes32 agreementId) external",
  "function executeLiquidation(bytes32 agreementId, uint256 recoveredAmount, uint256 shortfallAmount) external",
  "function releaseCollateral(bytes32 agreementId) external",
  "function closeAgreement(bytes32 agreementId) external",
  "function getAgreement(bytes32 agreementId) external view returns (address borrower, address borrowAsset, address collateralAsset, address treasuryReceiver, uint256 principalAmount, uint256 collateralAmount, uint256 serviceFeeAmount, uint256 recoveredAmount, uint256 shortfallAmount, uint256 nextDueAt, uint8 state, bool collateralLocked, bool initialized)"
] as const;

export type GovernanceAuthorityManifest = {
  authorityType: "governance_safe" | "treasury_safe" | "emergency_safe";
  address: string;
  chainId: number;
  label?: string;
};

export type GovernedSignerManifest = {
  scope:
    | "staking_execution"
    | "loan_execution"
    | "policy_withdrawal_authorization"
    | "policy_withdrawal_executor";
  keyReference: string;
  signerAddress: string;
};

export type ContractDeploymentManifestEntry = {
  productSurface: "staking_v1" | "loan_book_v1";
  version: string;
  address: string;
  abiChecksumSha256: string;
  legacyPath: boolean;
};

export type GovernedCustodyManifest = {
  environment: string;
  chainId: number;
  authorities: GovernanceAuthorityManifest[];
  signers: GovernedSignerManifest[];
  contracts: ContractDeploymentManifestEntry[];
};

export function createJsonRpcProvider(
  rpcUrl: string
): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

export function createStakingReadContract(
  contractAddress: string,
  providerOrSigner: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(
    contractAddress,
    STAKING_CONTRACT_ABI,
    providerOrSigner
  );
}

export function createStakingEventContract(
  contractAddress: string,
  provider: ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(contractAddress, STAKING_EVENT_ABI, provider);
}

export function createStakingWriteWallet(
  privateKey: string,
  provider: ethers.providers.Provider
): ethers.Wallet {
  return new ethers.Wallet(privateKey, provider);
}

export function createStakingWriteContract(
  contractAddress: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(contractAddress, STAKING_CONTRACT_ABI, signer);
}

export function createErc20TransferContract(
  contractAddress: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(contractAddress, ERC20_TRANSFER_ABI, signer);
}

export function createLoanBookReadContract(
  contractAddress: string,
  providerOrSigner: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(contractAddress, LOAN_BOOK_ABI, providerOrSigner);
}

export function createLoanBookWriteContract(
  contractAddress: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(contractAddress, LOAN_BOOK_ABI, signer);
}

export function createPolicyControlledWalletReadContract(
  contractAddress: string,
  providerOrSigner: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(
    contractAddress,
    POLICY_CONTROLLED_WALLET_ABI,
    providerOrSigner
  );
}

export function createPolicyControlledWalletWriteContract(
  contractAddress: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(contractAddress, POLICY_CONTROLLED_WALLET_ABI, signer);
}

export function createStakingV1Contract(
  contractAddress: string,
  providerOrSigner: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(contractAddress, STAKING_V1_ABI, providerOrSigner);
}

export function createLoanBookV1Contract(
  contractAddress: string,
  providerOrSigner: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(contractAddress, LOAN_BOOK_V1_ABI, providerOrSigner);
}

export function formatEthAmount(value: ethers.BigNumberish): string {
  return ethers.utils.formatEther(value);
}

export function parseEthAmount(value: string): ethers.BigNumber {
  return ethers.utils.parseEther(value.trim());
}

export function parseAssetAmount(
  value: string,
  decimals: number
): ethers.BigNumber {
  return ethers.utils.parseUnits(value.trim(), decimals);
}

export function hashPolicyControlledIntentId(intentId: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(intentId));
}

export async function signPolicyControlledWithdrawalAuthorization(args: {
  walletAddress: string;
  chainId: number;
  policySigner: ethers.Wallet;
  intentId: string;
  assetAddress: string | null;
  destinationAddress: string;
  amount: ethers.BigNumberish;
  authorizationNonce: ethers.BigNumberish;
  authorizationDeadline: ethers.BigNumberish;
}): Promise<string> {
  return args.policySigner._signTypedData(
    {
      name: "StealthTrailsPolicyWallet",
      version: "1",
      chainId: args.chainId,
      verifyingContract: args.walletAddress
    },
    {
      WithdrawalAuthorization: [
        { name: "intentId", type: "bytes32" },
        { name: "asset", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "authorizationNonce", type: "uint256" },
        { name: "authorizationDeadline", type: "uint256" }
      ]
    },
    {
      intentId: hashPolicyControlledIntentId(args.intentId),
      asset: args.assetAddress ?? ethers.constants.AddressZero,
      to: args.destinationAddress,
      amount: args.amount,
      authorizationNonce: args.authorizationNonce,
      authorizationDeadline: args.authorizationDeadline
    }
  );
}

export function normalizeEvmAddress(address: string | null | undefined): {
  normalizedAddress: string | null;
  reason?: string;
} {
  const rawAddress = address?.trim() ?? "";

  if (!rawAddress) {
    return {
      normalizedAddress: null
    };
  }

  if (!ethers.utils.isAddress(rawAddress)) {
    return {
      normalizedAddress: null,
      reason: "Address is not a valid EVM address."
    };
  }

  return {
    normalizedAddress: ethers.utils.getAddress(rawAddress).toLowerCase()
  };
}

export function loadGovernedCustodyManifest(
  manifestPath: string
): GovernedCustodyManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as GovernedCustodyManifest;
}
