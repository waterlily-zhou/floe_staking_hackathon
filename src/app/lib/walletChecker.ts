import { ethers } from "ethers";

// Common gauge addresses to check - these are the most popular Balancer gauges
const COMMON_GAUGES = [
  // Main Balancer gauges 
  "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f", // GHO/USDT/USDC
  "0xa6325e799d266632d347e41a471b22fbd5203ccd", // BAL/ETH
  "0x285ab19ed629f4b5b48c3c6dc4251f1aeaae8cd2", // BAL/WETH
  "0x0cb9cc35ceadb90319fc7c6dfa33288fc79b1286", // 80BAL-20WETH
  "0xad17a225074d76b7e169085b6101a007d0ad799a", // USDC/DAI/USDT
  "0xd6cb7eea40da32c83799812da5bdf93b72e1cd56", // 50WETH-50AURA
];

// Token information interface
interface TokenInfo {
  symbol: string;
  decimals: number;
  price: number;
}

// Interface for reward data
interface RewardData {
  amount: string;
  symbol: string;
  usdValue: number;
}

// Well-known reward tokens and prices
const KNOWN_TOKENS: Record<string, TokenInfo> = {
  "0xba100000625a3754423978a60c9317c58a424e3d": { symbol: "BAL", decimals: 18, price: 4.8 },
  "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f": { symbol: "GHO", decimals: 18, price: 0.98 },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18, price: 1800 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6, price: 1.0 },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6, price: 1.0 },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18, price: 1.0 }
};

// ABIs
const GAUGE_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function claimable_reward(address user, address token) view returns (uint256)",
  "function reward_tokens(uint256 index) view returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Interface for positions
interface Position {
  gauge: string;
  balance: string;
}

// Interface for return data
export interface WalletRewardsResult {
  address: string;
  positions: Position[];
  rewards: Record<string, Record<string, RewardData>>;
  totalRewardsValue: number;
  error?: string;
}

// Check wallet positions and rewards
export async function checkWalletRewards(walletAddress: string): Promise<WalletRewardsResult> {
  try {
    console.log(`Checking rewards for ${walletAddress}...`);
    
    // Connect to the blockchain using a public RPC
    const rpcUrl = process.env.ETHEREUM_RPC || "https://eth.llamarpc.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Prepare results
    const positions: Position[] = [];
    const rewardsPerGauge: Record<string, Record<string, RewardData>> = {};
    let totalRewardsValue = 0;
    
    // Check each common gauge
    for (const gaugeAddress of COMMON_GAUGES) {
      try {
        console.log(`Checking gauge ${gaugeAddress}`);
        const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, provider);
        
        // Check if wallet has position in this gauge
        const balance = await gauge.balanceOf(walletAddress);
        
        if (balance > 0n) {
          positions.push({
            gauge: gaugeAddress,
            balance: ethers.formatEther(balance)
          });
          
          // Check for claimable rewards
          rewardsPerGauge[gaugeAddress] = {};
          
          // First check for rewards using common reward tokens
          for (const [tokenAddress, tokenInfo] of Object.entries(KNOWN_TOKENS)) {
            try {
              const claimable = await gauge.claimable_reward(walletAddress, tokenAddress);
              if (claimable > 0n) {
                const formattedAmount = ethers.formatUnits(claimable, tokenInfo.decimals);
                const usdValue = parseFloat(formattedAmount) * tokenInfo.price;
                
                // Normalize token address to lowercase for consistent keys
                const normalizedTokenAddress = tokenAddress.toLowerCase();
                
                rewardsPerGauge[gaugeAddress][normalizedTokenAddress] = {
                  amount: formattedAmount,
                  symbol: tokenInfo.symbol,
                  usdValue
                };
                
                totalRewardsValue += usdValue;
              }
            } catch (error) {
              console.log(`Error checking ${tokenInfo.symbol} rewards: ${error}`);
            }
          }
          
          // Try to discover other reward tokens
          try {
            let index = 0;
            while (index < 5) { // Only check first 5 reward tokens for efficiency
              try {
                const tokenAddress = await gauge.reward_tokens(index);
                
                // Normalize token address to lowercase
                const normalizedTokenAddress = tokenAddress.toLowerCase();
                
                // Skip if we already checked this token
                if (rewardsPerGauge[gaugeAddress][normalizedTokenAddress]) {
                  index++;
                  continue;
                }
                
                // Get token info
                let symbol = "UNKNOWN";
                let decimals = 18;
                let price = 0;
                
                try {
                  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                  symbol = await token.symbol();
                  decimals = await token.decimals();
                  
                  // Use a default price of $1 for unknown tokens
                  price = 1;
                } catch (e) {
                  console.log(`Error getting token info: ${e}`);
                }
                
                // Get claimable amount
                const claimable = await gauge.claimable_reward(walletAddress, tokenAddress);
                if (claimable > 0n) {
                  const formattedAmount = ethers.formatUnits(claimable, decimals);
                  const usdValue = parseFloat(formattedAmount) * price;
                  
                  rewardsPerGauge[gaugeAddress][normalizedTokenAddress] = {
                    amount: formattedAmount,
                    symbol,
                    usdValue
                  };
                  
                  totalRewardsValue += usdValue;
                }
                
                index++;
              } catch (error) {
                // No more reward tokens
                break;
              }
            }
          } catch (error) {
            console.log(`Error discovering reward tokens: ${error}`);
          }
        }
      } catch (error) {
        console.log(`Error checking gauge ${gaugeAddress}: ${error}`);
      }
    }
    
    return {
      address: walletAddress,
      positions,
      rewards: rewardsPerGauge,
      totalRewardsValue
    };
  } catch (error: unknown) {
    console.error("Error checking wallet:", error);
    return {
      address: walletAddress,
      error: error instanceof Error ? error.message : String(error),
      positions: [],
      rewards: {},
      totalRewardsValue: 0
    };
  }
} 