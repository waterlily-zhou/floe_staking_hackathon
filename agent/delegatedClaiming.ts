import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// ABI for the AutoClaimDelegator contract with multiple thresholds
const DELEGATOR_ABI = [
  "function hasDelegatedClaims(address user) view returns (bool)",
  "function userThresholds(address user) view returns (uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, bool initialized)",
  "function delegationExpiry(address user) view returns (uint256)",
  "function shouldClaim(address user, uint256 currentRewardsUsd, uint256 gasPrice, uint256 estimatedGasCost, uint256 estimatedCompoundReturn) view returns (bool)",
  "function shouldClaimSimple(address user, uint256 currentRewardsUsd) view returns (bool)",
  "function getDelegationDetails(address user) view returns (bool hasValidDelegation, uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, uint256 expiry)",
  "function executeClaimOnBehalf(address user, address gaugeAddress, address[] calldata rewardTokens) external",
  "function batchClaimOnBehalf(address user, address[] calldata gaugeAddresses, address[][] calldata rewardTokensPerGauge) external",
  "function delegateClaims(uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, uint256 durationDays) external",
  "function revokeDelegation() external"
];

// Define interface for claim details
interface ClaimDelegationDetails {
  hasDelegated: boolean;
  minRewardsUsd: number;
  gasAwareRatio: number;
  compoundAwareRatio: number;
  expiryDate: Date | null;
  isExpired: boolean;
}

// Reward token interface
interface RewardToken {
  address: string;
  symbol: string;
}

/**
 * Check if a user has delegated claim permissions
 * @param userAddress Wallet address to check
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Information about the delegation status
 */
export async function checkDelegationStatus(
  userAddress: string,
  delegatorContractAddress: string
): Promise<ClaimDelegationDetails> {
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    
    // Connect to the delegator contract
    const delegatorContract = new ethers.Contract(
      delegatorContractAddress,
      DELEGATOR_ABI,
      provider
    );
    
    // Get delegation details
    const [
      hasValidDelegation, 
      minRewardsUsd, 
      gasAwareRatio, 
      compoundAwareRatio, 
      expiryTimestamp
    ] = await delegatorContract.getDelegationDetails(userAddress);
    
    // Format thresholds (convert from wei to ETH)
    const minRewardsValue = parseFloat(ethers.formatUnits(minRewardsUsd, 18));
    const gasAwareValue = parseFloat(ethers.formatUnits(gasAwareRatio, 18));
    const compoundAwareValue = parseFloat(ethers.formatUnits(compoundAwareRatio, 18));
    
    // Format expiry
    const expiryDate = expiryTimestamp > 0n ? new Date(Number(expiryTimestamp) * 1000) : null;
    const isExpired = expiryDate ? expiryDate < new Date() : false;
    
    return {
      hasDelegated: hasValidDelegation,
      minRewardsUsd: minRewardsValue,
      gasAwareRatio: gasAwareValue,
      compoundAwareRatio: compoundAwareValue,
      expiryDate,
      isExpired
    };
  } catch (error) {
    console.error(`Error checking delegation status: ${error}`);
    // Return default values indicating no delegation
    return {
      hasDelegated: false,
      minRewardsUsd: 0,
      gasAwareRatio: 0,
      compoundAwareRatio: 0,
      expiryDate: null,
      isExpired: true
    };
  }
}

/**
 * Check if a user has met any of their claim thresholds
 * @param userAddress Wallet address to check
 * @param currentRewardsUsd Current rewards value in USD
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @param gasPriceGwei Current gas price in gwei
 * @param estimatedGasCostGwei Estimated gas cost in gwei
 * @param estimatedCompoundReturnUsd Estimated compound return in USD
 * @returns Whether claiming should proceed
 */
export async function shouldClaimForUser(
  userAddress: string,
  currentRewardsUsd: number,
  delegatorContractAddress: string,
  gasPriceGwei: number = 50, // Default to 50 gwei if not provided
  estimatedGasCostGwei: number = 300000, // Default estimate if not provided
  estimatedCompoundReturnUsd: number = 0 // Default to 0 if not provided
): Promise<boolean> {
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    
    // Connect to the delegator contract
    const delegatorContract = new ethers.Contract(
      delegatorContractAddress,
      DELEGATOR_ABI,
      provider
    );
    
    // Convert values to wei format (18 decimals)
    const rewardsWei = ethers.parseUnits(currentRewardsUsd.toString(), 18);
    const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), 9); // Convert from gwei to wei
    const estimatedGasCostWei = BigInt(estimatedGasCostGwei);
    const estimatedCompoundReturnWei = ethers.parseUnits(estimatedCompoundReturnUsd.toString(), 18);
    
    // Check if should claim using the enhanced function
    return await delegatorContract.shouldClaim(
      userAddress,
      rewardsWei,
      gasPriceWei,
      estimatedGasCostWei,
      estimatedCompoundReturnWei
    );
  } catch (error) {
    console.error(`Error checking if should claim: ${error}`);
    
    // Try the simpler version as fallback
    try {
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
      const delegatorContract = new ethers.Contract(
        delegatorContractAddress,
        DELEGATOR_ABI,
        provider
      );
      
      const rewardsWei = ethers.parseUnits(currentRewardsUsd.toString(), 18);
      return await delegatorContract.shouldClaimSimple(userAddress, rewardsWei);
    } catch (fallbackError) {
      console.error(`Fallback check also failed: ${fallbackError}`);
      return false;
    }
  }
}

/**
 * Execute claim on behalf of a user using the delegation contract
 * @param userAddress User's wallet address
 * @param gaugeAddresses Array of gauge contract addresses
 * @param rewardTokensPerGauge Array of arrays containing reward tokens for each gauge
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Transaction hash if successful
 */
export async function executeClaimWithDelegation(
  userAddress: string,
  gaugeAddresses: string[],
  rewardTokensPerGauge: string[][],
  delegatorContractAddress: string
): Promise<string> {
  try {
    // Check for private key
    if (!process.env.ADMIN_PRIVATE_KEY) {
      throw new Error("ADMIN_PRIVATE_KEY environment variable is required for executing delegated claims");
    }
    
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    
    // Connect to the delegator contract with signer
    const delegatorContract = new ethers.Contract(
      delegatorContractAddress,
      DELEGATOR_ABI,
      adminWallet
    );
    
    // Execute the batch claim
    const tx = await delegatorContract.batchClaimOnBehalf(
      userAddress,
      gaugeAddresses,
      rewardTokensPerGauge
    );
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    
    console.log(`Delegated claim executed for ${userAddress}. Transaction hash: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    console.error(`Error executing delegated claim: ${error}`);
    throw error;
  }
}

/**
 * Delegate claim permissions with multiple thresholds
 * @param userAddress User's wallet address
 * @param minRewardsUsd Minimum rewards in USD to trigger claim
 * @param gasAwareRatio Gas-aware threshold (rewards/gas ratio)
 * @param compoundAwareRatio Compound-aware threshold
 * @param durationDays Duration in days
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Transaction hash if successful
 */
export async function delegateWithMultipleThresholds(
  userAddress: string,
  minRewardsUsd: number,
  gasAwareRatio: number,
  compoundAwareRatio: number,
  durationDays: number,
  delegatorContractAddress: string,
  privateKey: string
): Promise<string> {
  try {
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Check if the wallet address matches the provided userAddress
    const walletAddress = await wallet.getAddress();
    if (walletAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error("Wallet address does not match the provided user address");
    }
    
    // Connect to the delegator contract with signer
    const delegatorContract = new ethers.Contract(
      delegatorContractAddress,
      DELEGATOR_ABI,
      wallet
    );
    
    // Convert values to wei format (18 decimals)
    const minRewardsWei = ethers.parseUnits(minRewardsUsd.toString(), 18);
    const gasAwareRatioWei = ethers.parseUnits(gasAwareRatio.toString(), 18);
    const compoundAwareRatioWei = ethers.parseUnits(compoundAwareRatio.toString(), 18);
    
    // Execute the delegation
    const tx = await delegatorContract.delegateClaims(
      minRewardsWei,
      gasAwareRatioWei,
      compoundAwareRatioWei,
      durationDays
    );
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    
    console.log(`Delegation created for ${userAddress}. Transaction hash: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    console.error(`Error creating delegation: ${error}`);
    throw error;
  }
}

/**
 * Check all user delegations and process claims if thresholds are met
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 */
export async function processDelegatedClaims(delegatorContractAddress: string): Promise<void> {
  // This would be called by a scheduled task
  // Implementation would be similar to original with enhanced functions
  console.log("Processing delegated claims (placeholder for implementation)");
} 