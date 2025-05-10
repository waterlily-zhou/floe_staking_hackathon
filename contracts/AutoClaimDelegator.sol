// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AutoClaimDelegator
 * @dev Enhanced version of AutoClaimDelegator that supports multiple threshold types:
 * 1. Minimum rewards threshold
 * 2. Gas-aware threshold (rewards/gas ratio)
 * 3. Compound-aware threshold (expected compound reward/gas ratio)
 */
contract AutoClaimDelegator {
    // The admin address that controls the service
    address public admin;
    
    // Delegation state
    mapping(address => bool) public hasDelegatedClaims;
    mapping(address => uint256) public delegationExpiry;
    
    // Threshold parameters - all values are scaled by 1e18
    struct ClaimThresholds {
        uint256 minRewardsUsd;     // Minimum rewards in USD
        uint256 gasAwareRatio;     // Reward/gas ratio threshold
        uint256 compoundAwareRatio; // Expected compound reward/gas ratio
        bool initialized;          // Whether the thresholds have been set
    }
    
    // Mapping from user address to their claim thresholds
    mapping(address => ClaimThresholds) public userThresholds;
    
    // Events
    event ClaimDelegated(
        address indexed user, 
        uint256 minRewardsUsd, 
        uint256 gasAwareRatio, 
        uint256 compoundAwareRatio, 
        uint256 expiry
    );
    event ClaimRevoked(address indexed user);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RatioCalculated(
        string ratioType,
        uint256 numerator,
        uint256 denominator,
        uint256 ratio,
        uint256 threshold
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier onlyDelegated(address user) {
        require(
            hasDelegatedClaims[user] && delegationExpiry[user] >= block.timestamp,
            "No valid delegation for this user"
        );
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Change the admin address
     * @param newAdmin The address of the new admin
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
    }
    
    /**
     * @dev Delegate claim permissions to the auto-claim service
     * @param minRewardsUsd The minimum USD value threshold (scaled by 1e18)
     * @param gasAwareRatio The gas-aware threshold (scaled by 1e18)
     * @param compoundAwareRatio The compound-aware threshold (scaled by 1e18)
     * @param durationDays How many days this delegation should be valid for
     */
    function delegateClaims(
        uint256 minRewardsUsd, 
        uint256 gasAwareRatio, 
        uint256 compoundAwareRatio, 
        uint256 durationDays
    ) external {
        require(durationDays > 0 && durationDays <= 365, "Duration must be between 1 and 365 days");
        
        // Require at least one threshold to be set
        require(
            minRewardsUsd > 0 || gasAwareRatio > 0 || compoundAwareRatio > 0,
            "At least one threshold must be greater than 0"
        );
        
        // Set delegation status
        hasDelegatedClaims[msg.sender] = true;
        delegationExpiry[msg.sender] = block.timestamp + (durationDays * 1 days);
        
        // Set thresholds
        userThresholds[msg.sender] = ClaimThresholds({
            minRewardsUsd: minRewardsUsd,
            gasAwareRatio: gasAwareRatio,
            compoundAwareRatio: compoundAwareRatio,
            initialized: true
        });
        
        // Emit event
        emit ClaimDelegated(
            msg.sender, 
            minRewardsUsd, 
            gasAwareRatio, 
            compoundAwareRatio, 
            delegationExpiry[msg.sender]
        );
    }
    
    /**
     * @dev Revoke claim permissions
     */
    function revokeDelegation() external {
        hasDelegatedClaims[msg.sender] = false;
        emit ClaimRevoked(msg.sender);
    }
    
    /**
     * @dev Execute a claim call on behalf of a user (only callable by admin)
     * @param user The address of the user to claim for
     * @param gaugeAddress The address of the gauge to claim from
     * @param rewardTokens Array of reward token addresses to claim
     */
    function executeClaimOnBehalf(
        address user,
        address gaugeAddress,
        address[] memory rewardTokens
    ) internal onlyAdmin onlyDelegated(user) {
        // Interface for gauge
        bytes4 claimSignature = bytes4(keccak256("claim_rewards(address,address)"));
        
        // Call claim_rewards for each reward token
        for (uint i = 0; i < rewardTokens.length; i++) {
            // Call the gauge contract to claim rewards
            (bool success, ) = gaugeAddress.call(
                abi.encodeWithSelector(claimSignature, user, rewardTokens[i])
            );
            require(success, "Claim rewards call failed");
        }
        
        emit RewardsClaimed(user, block.timestamp);
    }
    
    /**
     * @dev Batch claim rewards from multiple gauges
     * @param user The address of the user to claim for
     * @param gaugeAddresses Array of gauge addresses to claim from
     * @param rewardTokensPerGauge Array of arrays containing reward token addresses for each gauge
     */
    function batchClaimOnBehalf(
        address user,
        address[] calldata gaugeAddresses,
        address[][] calldata rewardTokensPerGauge
    ) external onlyAdmin onlyDelegated(user) {
        require(
            gaugeAddresses.length == rewardTokensPerGauge.length, 
            "Array length mismatch"
        );
        
        // Claim from each gauge
        for (uint i = 0; i < gaugeAddresses.length; i++) {
            address[] memory tokens = rewardTokensPerGauge[i];
            executeClaimOnBehalf(user, gaugeAddresses[i], tokens);
        }
    }
    
    /**
     * @dev Calculate ratio between two numbers, scaling appropriately
     * @param numerator The numerator (in 1e18)
     * @param denominator The denominator (in 1e9)
     * @return The ratio in 1e9 units
     */
    function calculateRatio(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        // If denominator is 0, return 0 to avoid division by zero
        if (denominator == 0) return 0;
        
        // Scale the numerator down by 1e9 to match the denominator's scale
        // This gives us a ratio in 1e9 units
        return (numerator * 1e9) / denominator;
    }
    
    /**
     * @dev Check if a user has a valid delegation and if all their set thresholds are met
     * @param user The address of the user
     * @param currentRewardsUsd The current rewards value in USD (scaled by 1e18)
     * @param gasPrice Current gas price in gwei (scaled by 1e9)
     * @param estimatedGasCost Estimated gas cost for the claim operation in gwei (scaled by 1e9)
     * @param estimatedCompoundReturn Estimated compound return in USD (scaled by 1e18)
     * @return boolean indicating if claiming should proceed
     */
    function shouldClaim(
        address user,
        uint256 currentRewardsUsd,
        uint256 gasPrice,
        uint256 estimatedGasCost,
        uint256 estimatedCompoundReturn
    ) external view returns (bool) {
        // First check if delegation is valid
        if (!hasDelegatedClaims[user] || delegationExpiry[user] < block.timestamp) {
            return false;
        }
        
        // Get user thresholds
        ClaimThresholds storage thresholds = userThresholds[user];
        
        // If thresholds not initialized, don't claim
        if (!thresholds.initialized) {
            return false;
        }
        
        // Calculate gas cost in USD (gasPrice in gwei, estimatedGasCost in gas units)
        // gasPrice is in gwei (1e9), estimatedGasCost in gas units
        // We need to multiply them to get the cost in gwei
        uint256 gasCostUsd = gasPrice * estimatedGasCost;
        
        // Check all set thresholds - only check thresholds that are set (greater than 0)
        
        // 1. Minimum rewards threshold
        if (thresholds.minRewardsUsd > 0 && currentRewardsUsd < thresholds.minRewardsUsd) {
            return false;
        }
        
        // 2. Gas-aware threshold (rewards/gas ratio)
        if (thresholds.gasAwareRatio > 0 && gasCostUsd > 0) {
            // Calculate ratio: currentRewardsUsd / gasCostUsd
            // currentRewardsUsd is in 1e18, gasCostUsd is in gwei (1e9)
            // The ratio will be in 1e9 units, matching the threshold
            uint256 rewardGasRatio = calculateRatio(currentRewardsUsd, gasCostUsd);
            if (rewardGasRatio < thresholds.gasAwareRatio) {
                return false;
            }
        }
        
        // 3. Compound-aware threshold
        if (thresholds.compoundAwareRatio > 0 && gasCostUsd > 0 && estimatedCompoundReturn > 0) {
            // Calculate ratio: estimatedCompoundReturn / gasCostUsd
            // estimatedCompoundReturn is in 1e18, gasCostUsd is in gwei (1e9)
            // The ratio will be in 1e9 units, matching the threshold
            uint256 compoundGasRatio = calculateRatio(estimatedCompoundReturn, gasCostUsd);
            if (compoundGasRatio < thresholds.compoundAwareRatio) {
                return false;
            }
        }
        
        // All set thresholds were met
        return true;
    }
    
    /**
     * @dev Get delegation details for a user
     * @param user The address to check
     * @return hasValidDelegation Whether the user has a valid delegation
     * @return minRewardsUsd Minimum rewards threshold
     * @return gasAwareRatio Gas-aware threshold
     * @return compoundAwareRatio Compound-aware threshold
     * @return expiry When the delegation expires
     */
    function getDelegationDetails(address user) external view returns (
        bool hasValidDelegation,
        uint256 minRewardsUsd,
        uint256 gasAwareRatio,
        uint256 compoundAwareRatio,
        uint256 expiry
    ) {
        hasValidDelegation = hasDelegatedClaims[user] && delegationExpiry[user] >= block.timestamp;
        ClaimThresholds storage thresholds = userThresholds[user];
        
        if (thresholds.initialized) {
            minRewardsUsd = thresholds.minRewardsUsd;
            gasAwareRatio = thresholds.gasAwareRatio;
            compoundAwareRatio = thresholds.compoundAwareRatio;
        }
        
        expiry = delegationExpiry[user];
    }
} 