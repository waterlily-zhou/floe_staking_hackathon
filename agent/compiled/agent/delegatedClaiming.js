"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDelegationStatus = checkDelegationStatus;
exports.shouldClaimForUser = shouldClaimForUser;
exports.executeClaimWithDelegation = executeClaimWithDelegation;
exports.delegateWithMultipleThresholds = delegateWithMultipleThresholds;
exports.processDelegatedClaims = processDelegatedClaims;
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
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
/**
 * Check if a user has delegated claim permissions
 * @param userAddress Wallet address to check
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Information about the delegation status
 */
async function checkDelegationStatus(userAddress, delegatorContractAddress) {
    try {
        // Initialize provider
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        // Connect to the delegator contract
        const delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
        // Get delegation details
        const [hasValidDelegation, minRewardsUsd, gasAwareRatio, compoundAwareRatio, expiryTimestamp] = await delegatorContract.getDelegationDetails(userAddress);
        // Format thresholds (convert from wei to ETH)
        const minRewardsValue = parseFloat(ethers_1.ethers.formatUnits(minRewardsUsd, 18));
        const gasAwareValue = parseFloat(ethers_1.ethers.formatUnits(gasAwareRatio, 18));
        const compoundAwareValue = parseFloat(ethers_1.ethers.formatUnits(compoundAwareRatio, 18));
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
    }
    catch (error) {
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
async function shouldClaimForUser(userAddress, currentRewardsUsd, delegatorContractAddress, gasPriceGwei = 50, // Default to 50 gwei if not provided
estimatedGasCostGwei = 300000, // Default estimate if not provided
estimatedCompoundReturnUsd = 0 // Default to 0 if not provided
) {
    try {
        // Initialize provider
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        // Connect to the delegator contract
        const delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
        // Convert values to wei format (18 decimals)
        const rewardsWei = ethers_1.ethers.parseUnits(currentRewardsUsd.toString(), 18);
        const gasPriceWei = ethers_1.ethers.parseUnits(gasPriceGwei.toString(), 9); // Convert from gwei to wei
        const estimatedGasCostWei = BigInt(estimatedGasCostGwei);
        const estimatedCompoundReturnWei = ethers_1.ethers.parseUnits(estimatedCompoundReturnUsd.toString(), 18);
        // Check if should claim using the enhanced function
        return await delegatorContract.shouldClaim(userAddress, rewardsWei, gasPriceWei, estimatedGasCostWei, estimatedCompoundReturnWei);
    }
    catch (error) {
        console.error(`Error checking if should claim: ${error}`);
        // Try the simpler version as fallback
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
            const delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
            const rewardsWei = ethers_1.ethers.parseUnits(currentRewardsUsd.toString(), 18);
            return await delegatorContract.shouldClaimSimple(userAddress, rewardsWei);
        }
        catch (fallbackError) {
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
async function executeClaimWithDelegation(userAddress, gaugeAddresses, rewardTokensPerGauge, delegatorContractAddress) {
    try {
        // Check for private key
        if (!process.env.ADMIN_PRIVATE_KEY) {
            throw new Error("ADMIN_PRIVATE_KEY environment variable is required for executing delegated claims");
        }
        // Initialize provider and signer
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const adminWallet = new ethers_1.ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
        // Connect to the delegator contract with signer
        const delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, adminWallet);
        // Execute the batch claim
        const tx = await delegatorContract.batchClaimOnBehalf(userAddress, gaugeAddresses, rewardTokensPerGauge);
        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        console.log(`Delegated claim executed for ${userAddress}. Transaction hash: ${receipt.hash}`);
        return receipt.hash;
    }
    catch (error) {
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
async function delegateWithMultipleThresholds(userAddress, minRewardsUsd, gasAwareRatio, compoundAwareRatio, durationDays, delegatorContractAddress, privateKey) {
    try {
        // Initialize provider and signer
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        // Check if the wallet address matches the provided userAddress
        const walletAddress = await wallet.getAddress();
        if (walletAddress.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error("Wallet address does not match the provided user address");
        }
        // Connect to the delegator contract with signer
        const delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, wallet);
        // Convert values to wei format (18 decimals)
        const minRewardsWei = ethers_1.ethers.parseUnits(minRewardsUsd.toString(), 18);
        const gasAwareRatioWei = ethers_1.ethers.parseUnits(gasAwareRatio.toString(), 18);
        const compoundAwareRatioWei = ethers_1.ethers.parseUnits(compoundAwareRatio.toString(), 18);
        // Execute the delegation
        const tx = await delegatorContract.delegateClaims(minRewardsWei, gasAwareRatioWei, compoundAwareRatioWei, durationDays);
        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        console.log(`Delegation created for ${userAddress}. Transaction hash: ${receipt.hash}`);
        return receipt.hash;
    }
    catch (error) {
        console.error(`Error creating delegation: ${error}`);
        throw error;
    }
}
/**
 * Check all user delegations and process claims if thresholds are met
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 */
async function processDelegatedClaims(delegatorContractAddress) {
    // This would be called by a scheduled task
    // Implementation would be similar to original with enhanced functions
    console.log("Processing delegated claims (placeholder for implementation)");
}
//# sourceMappingURL=delegatedClaiming.js.map