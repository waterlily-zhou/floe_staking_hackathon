/**
 * File containing contract addresses and configurations
 */

// This address should be updated after deployment
export const AUTO_CLAIM_DELEGATOR_ADDRESS = {
  // Ethereum Mainnet
  1: "0x0000000000000000000000000000000000000000", // Replace with actual deployed address
  
  // Goerli Testnet
  5: "0x0000000000000000000000000000000000000000", // Replace with testnet deployed address
  
  // Sepolia Testnet
  11155111: "0xD2E1146CB2E4350b63242188Fcd931f047824E6B", // Deployed AutoClaimDelegator contract
};

// Auto Claim Delegator ABI (key functions only)
export const AUTO_CLAIM_DELEGATOR_ABI = [
  {
    name: "delegateClaims",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "minRewardsUsd",
        type: "uint256",
        description: "Minimum rewards threshold in USD (18 decimals)"
      },
      {
        name: "gasAwareRatio",
        type: "uint256",
        description: "Gas-aware ratio threshold (18 decimals)"
      },
      {
        name: "compoundAwareRatio",
        type: "uint256",
        description: "Compound-aware ratio threshold (18 decimals)"
      },
      {
        name: "durationDays",
        type: "uint256",
        description: "Duration of delegation in days"
      }
    ],
    outputs: []
  },
  {
    name: "revokeDelegation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    name: "getDelegationDetails",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address"
      }
    ],
    outputs: [
      {
        name: "hasValidDelegation",
        type: "bool"
      },
      {
        name: "minRewardsUsd",
        type: "uint256"
      },
      {
        name: "gasAwareRatio",
        type: "uint256"
      },
      {
        name: "compoundAwareRatio",
        type: "uint256"
      },
      {
        name: "expiry",
        type: "uint256"
      }
    ]
  }
];

// Original version used in development - keep for reference
// export const AUTO_CLAIM_DELEGATOR_ABI = [
//   "function delegateClaims(uint256 minRewards, uint256 gasAware, uint256 compoundAware, uint256 durationWeeks) external",
//   "function revokeDelegation() external",
//   "function getDelegationDetails(address user) external view returns (bool hasValidDelegation, uint256 threshold, uint256 expiry)"
// ]; 