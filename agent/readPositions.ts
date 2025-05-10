import { ethers } from 'ethers';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { NextResponse } from 'next/server';
import path from 'path';
dotenv.config();

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const GAUGE_ABI = [
  "function deposit(uint256 value) external",
  "function balanceOf(address) view returns (uint256)",
  "function claimable_reward(address user, address token) external view returns (uint256)",
  "function claimable_tokens(address user) external view returns (uint256)",
  "function reward_tokens(uint256 index) external view returns (address)",
  "function reward_count() external view returns (uint256)"
];

// Your pool and gauge addresses
const POOL_ADDRESS = "0x85b2b559bc2d21104c4defdd6efca8a20343361d";
const BPT_ADDRESS = "0x85b2b559bc2d21104c4defdd6efca8a20343361d"; // Using pool address as BPT address
const GAUGE_ADDRESS = "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f";

// Additional commonly used gauges to check (to be more comprehensive)
export const COMMON_GAUGES = [
  // GHO/USDT/USDC pool gauge
  {
    gauge: "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f",
    pool: "0x85b2b559bc2d21104c4defdd6efca8a20343361d",
    name: "GHO/USDT/USDC"
  },
  // Add other common gauges/pools
  {
    gauge: "0xa6325e799d266632d347e41a471b22fbd5203ccd",
    pool: "0x0b09dec45db1bdeae144e48cad7a8e4466795bc9",
    name: "BAL/ETH"
  },
  {
    gauge: "0x285ab19ed629f4b5b48c3c6dc4251f1aeaae8cd2", 
    pool: "0x32296969ef14eb0c6d29669c550d4a0449130230",
    name: "BAL/WETH"
  }
];

// Balancer core contract addresses from the screenshot
const BALANCER_QUERIES_ADDRESS = "0xE39B5e3B6D74016D740074C991C02070c02D567D";
const BAL_TOKEN_ADDRESS = "0xba100000625a3754423978a60c9317c58a424e3d"; // BAL token address
const GHO_TOKEN_ADDRESS = "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"; // GHO token address

// Cache for token prices to avoid multiple API calls
const tokenPriceCache: Record<string, number> = {};

// Helper to format amounts with proper decimals
function formatAmount(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Get token price in USD
 */
async function getTokenPrice(tokenAddress: string, tokenSymbol: string): Promise<number> {
  // Check cache first
  if (tokenPriceCache[tokenAddress]) {
    return tokenPriceCache[tokenAddress];
  }
  
  try {
    // Use CoinGecko API to get token price
    // Note: Free API has rate limits, might need API key for production use
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`
    );
    
    if (response.data && response.data[tokenAddress.toLowerCase()] && response.data[tokenAddress.toLowerCase()].usd) {
      const price = response.data[tokenAddress.toLowerCase()].usd;
      tokenPriceCache[tokenAddress] = price;
      return price;
    }
    
    // Fallback prices for known tokens if API doesn't return data
    const knownTokens: Record<string, number> = {
      'BAL': 4.50,  // Updated BAL price
      'GHO': 0.98,  // Updated GHO price
      'USDC': 1.0,
      'USDT': 1.0,
      'DAI': 1.0
    };
    
    if (knownTokens[tokenSymbol]) {
      console.log(`Using fallback price for ${tokenSymbol}: $${knownTokens[tokenSymbol]}`);
      tokenPriceCache[tokenAddress] = knownTokens[tokenSymbol];
      return knownTokens[tokenSymbol];
    }
    
    // Default fallback
    console.log(`Could not get price for ${tokenSymbol}, using $1.0 as fallback`);
    tokenPriceCache[tokenAddress] = 1.0;
    return 1.0;
  } catch (error: any) {
    console.log(`Error fetching price for ${tokenSymbol}: ${error.message}`);
    
    // Fallback prices for known tokens
    const knownTokens: Record<string, number> = {
      'BAL': 4.50,  // Updated BAL price
      'GHO': 0.98,  // Updated GHO price
      'USDC': 1.0,
      'USDT': 1.0,
      'DAI': 1.0
    };
    
    if (knownTokens[tokenSymbol]) {
      console.log(`Using fallback price for ${tokenSymbol}: $${knownTokens[tokenSymbol]}`);
      tokenPriceCache[tokenAddress] = knownTokens[tokenSymbol];
      return knownTokens[tokenSymbol];
    }
    
    // Default fallback
    tokenPriceCache[tokenAddress] = 1.0;
    return 1.0;
  }
}

/**
 * Get price for BPT (Balancer Pool Token)
 * This is a simplified estimate and would need pool composition data for accuracy
 */
async function getBPTPrice(bptAddress: string, bptSymbol: string): Promise<number> {
  try {
    // For Balancer pool tokens, we can estimate based on the pool composition
    // For now, we'll use a simplified approach with fallback values
    // In production, you'd want to query Balancer's API or subgraph
    
    // Hardcoded fallback values for known pools
    const knownPools: Record<string, number> = {
      // Simple pool price estimates
      // Format: 'poolAddress': price
      [POOL_ADDRESS.toLowerCase()]: 1.02  // Example price for a stablecoin pool
    };
    
    if (knownPools[bptAddress.toLowerCase()]) {
      return knownPools[bptAddress.toLowerCase()];
    }
    
    // For unknown pools, try Coingecko first
    try {
      const price = await getTokenPrice(bptAddress, bptSymbol);
      return price;
    } catch {
      // If that fails, provide a fallback
      console.log(`Using fallback price for ${bptSymbol}`);
      return 1.0;
    }
  } catch (error: any) {
    console.log(`Error getting BPT price: ${error.message}`);
    return 1.0;
  }
}

/**
 * Read current staking position and claimable rewards
 */
async function readStakingPosition(walletAddress?: string) {
  // Initialize provider from environment variable
  const rpcUrl = process.env.ETHEREUM_RPC || "https://eth.llamarpc.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 READING BALANCER STAKING POSITION`);
  console.log(`${"=".repeat(60)}\n`);
  
  try {
    // Get wallet address from private key or use provided address
    let address: string;
    if (walletAddress) {
      address = walletAddress;
      console.log(`Using provided address: ${address}`);
    } else if (process.env.PRIVATE_KEY) {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      address = await wallet.getAddress();
      console.log(`Using wallet address: ${address}`);
    } else if (process.env.ACCOUNT) {
      // Support for hardhat account format
      address = process.env.ACCOUNT;
      console.log(`Using ACCOUNT from .env: ${address}`);
    } else {
      throw new Error("No wallet address provided. Set PRIVATE_KEY or ACCOUNT in .env or provide an address.");
    }
    
    // Get network info
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})\n`);
    
    // Results to track all positions and rewards
    const positionResults = {
      unstaked: {
        balance: "0",
        token: "",
        valueUSD: 0
      },
      staked: {
        balance: "0",
        token: "",
        valueUSD: 0
      },
      rewards: {} as Record<string, any>,
      totalRewardsUSD: 0,
      totalPositionValueUSD: 0
    };
    
    // Check all gauges
    let foundAnyPosition = false; 
    for (const gaugeInfo of COMMON_GAUGES) {
      try {
        console.log(`\nChecking gauge: ${gaugeInfo.name} (${gaugeInfo.gauge})`);
        
        // Connect to contracts
        const bptToken = new ethers.Contract(gaugeInfo.pool, ERC20_ABI, provider);
        const gauge = new ethers.Contract(gaugeInfo.gauge, GAUGE_ABI, provider);
        
        // Get token info
        const bptDecimals = await bptToken.decimals();
        const bptSymbol = await bptToken.symbol();
        console.log(`Pool Token: ${bptSymbol} (${gaugeInfo.pool})`);
        
        // Get BPT price
        const bptPrice = await getBPTPrice(gaugeInfo.pool, bptSymbol);
        console.log(`Estimated BPT Price: $${bptPrice.toFixed(4)}`);
        
        // 1. Get unstaked BPT balance
        const bptBalance = await bptToken.balanceOf(address);
        const bptBalanceFormatted = formatAmount(bptBalance, bptDecimals);
        const bptValueUSD = parseFloat(bptBalanceFormatted) * bptPrice;
        
        if (bptBalance > 0n) {
          console.log(`\n📊 UNSTAKED POSITION (${gaugeInfo.name}):`);
          console.log(`${bptBalanceFormatted} ${bptSymbol} (unstaked) ≈ $${bptValueUSD.toFixed(2)}`);
          
          positionResults.unstaked.balance = (parseFloat(positionResults.unstaked.balance) + parseFloat(bptBalanceFormatted)).toString();
          positionResults.unstaked.token = bptSymbol;
          positionResults.unstaked.valueUSD += bptValueUSD;
          
          foundAnyPosition = true;
        }
        
        // 2. Get staked balance in gauge
        const stakedBalance = await gauge.balanceOf(address);
        const stakedBalanceFormatted = formatAmount(stakedBalance, bptDecimals);
        const stakedValueUSD = parseFloat(stakedBalanceFormatted) * bptPrice;
        
        if (stakedBalance > 0n) {
          console.log(`\n📊 STAKED POSITION (${gaugeInfo.name}):`);
          console.log(`${stakedBalanceFormatted} ${bptSymbol} (staked in gauge) ≈ $${stakedValueUSD.toFixed(2)}`);
          
          positionResults.staked.balance = (parseFloat(positionResults.staked.balance) + parseFloat(stakedBalanceFormatted)).toString();
          positionResults.staked.token = positionResults.staked.token ? `${positionResults.staked.token}, ${bptSymbol}` : bptSymbol;
          positionResults.staked.valueUSD += stakedValueUSD;
          
          foundAnyPosition = true;
          
          // 3. Get claimable BAL rewards
          try {
            const claimableBAL = await gauge.claimable_tokens(address);
            if (claimableBAL > 0n) {
              const balToken = new ethers.Contract(BAL_TOKEN_ADDRESS, ERC20_ABI, provider);
              const balDecimals = await balToken.decimals();
              const balFormatted = formatAmount(claimableBAL, balDecimals);
              
              // Get BAL price
              const balPrice = await getTokenPrice(BAL_TOKEN_ADDRESS, 'BAL');
              const balValueUSD = parseFloat(balFormatted) * balPrice;
              
              console.log(`\n🎁 CLAIMABLE REWARDS (${gaugeInfo.name}):`);
              console.log(`${balFormatted} BAL (protocol rewards) ≈ $${balValueUSD.toFixed(4)} @ $${balPrice.toFixed(2)}/BAL`);
              
              // Add to total rewards
              if (positionResults.rewards['BAL']) {
                positionResults.rewards['BAL'].amount = (parseFloat(positionResults.rewards['BAL'].amount) + parseFloat(balFormatted)).toString();
                positionResults.rewards['BAL'].valueUSD += balValueUSD;
              } else {
                positionResults.rewards['BAL'] = {
                  amount: balFormatted,
                  valueUSD: balValueUSD,
                  price: balPrice
                };
              }
              
              positionResults.totalRewardsUSD += balValueUSD;
            }
          } catch (error: any) {
            console.log(`Error getting BAL rewards: ${error.message}`);
          }
          
          // 4. Check for additional reward tokens
          try {
            const rewardCount = await gauge.reward_count();
            console.log(`\nAdditional Reward Tokens: ${rewardCount}`);
            
            if (rewardCount > 0) {
              for (let i = 0; i < Number(rewardCount); i++) {
                try {
                  const rewardTokenAddress = await gauge.reward_tokens(i);
                  const rewardToken = new ethers.Contract(rewardTokenAddress, ERC20_ABI, provider);
                  const rewardSymbol = await rewardToken.symbol();
                  const rewardDecimals = await rewardToken.decimals();
                  
                  const claimableReward = await gauge.claimable_reward(address, rewardTokenAddress);
                  if (claimableReward > 0n) {
                    const rewardFormatted = formatAmount(claimableReward, rewardDecimals);
                    
                    // Get token price
                    const tokenPrice = await getTokenPrice(rewardTokenAddress, rewardSymbol);
                    const rewardValueUSD = parseFloat(rewardFormatted) * tokenPrice;
                    
                    // Add to total rewards
                    if (positionResults.rewards[rewardSymbol]) {
                      positionResults.rewards[rewardSymbol].amount = (parseFloat(positionResults.rewards[rewardSymbol].amount) + parseFloat(rewardFormatted)).toString();
                      positionResults.rewards[rewardSymbol].valueUSD += rewardValueUSD;
                    } else {
                      positionResults.rewards[rewardSymbol] = {
                        amount: rewardFormatted,
                        valueUSD: rewardValueUSD,
                        price: tokenPrice
                      };
                    }
                    
                    positionResults.totalRewardsUSD += rewardValueUSD;
                    
                    console.log(`${rewardFormatted} ${rewardSymbol} (${rewardTokenAddress}) ≈ $${rewardValueUSD.toFixed(4)} @ $${tokenPrice.toFixed(2)}/${rewardSymbol}`);
                  }
                } catch (error: any) {
                  console.log(`Could not read reward token at index ${i}: ${error.message}`);
                }
              }
            }
          } catch (error: any) {
            console.log(`Gauge doesn't support multiple rewards: ${error.message}`);
          }
        }
      } catch (error: any) {
        console.log(`Error checking gauge ${gaugeInfo.name}: ${error.message}`);
        // Continue checking other gauges
      }
    }
    
    if (!foundAnyPosition) {
      console.log(`\n❌ No positions found for address: ${address}`);
    }
    
    // 5. Calculate total position value
    positionResults.totalPositionValueUSD = positionResults.unstaked.valueUSD + positionResults.staked.valueUSD + positionResults.totalRewardsUSD;
    
    console.log(`\n💰 TOTAL POSITION VALUE:`);
    console.log(`Unstaked: $${positionResults.unstaked.valueUSD.toFixed(2)}`);
    console.log(`Staked: $${positionResults.staked.valueUSD.toFixed(2)}`);
    console.log(`Rewards: $${positionResults.totalRewardsUSD.toFixed(4)}`);
    console.log(`TOTAL: $${positionResults.totalPositionValueUSD.toFixed(2)}`);
    
    console.log(`\n${"=".repeat(60)}`);
    return positionResults;
    
  } catch (error: any) {
    console.error(`❌ Error reading staking position: ${error.message}`);
    if (error.data) {
      console.error(`Error data: ${error.data}`);
    }
    throw error;
  }
}

/**
 * Read positions for multiple addresses
 */
async function readMultiplePositions(addresses: string[]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 READING MULTIPLE BALANCER STAKING POSITIONS`);
  console.log(`${"=".repeat(60)}\n`);
  
  const results: Record<string, any> = {};
  
  for (const address of addresses) {
    console.log(`\nReading position for address: ${address}`);
    try {
      const result = await readStakingPosition(address);
      results[address] = result;
    } catch (error: any) {
      console.error(`Failed to read position for ${address}: ${error.message}`);
      results[address] = { error: error.message };
    }
  }
  
  // Save results to a file
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = `${dataDir}/multiple_positions_${timestamp}.json`;
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\nAll positions data saved to ${resultFile}`);
  
  return results;
}

/**
 * Display help message explaining how to use the script
 */
function displayHelp() {
  console.log(`
Balancer Staking Position Reader
================================

This script reads your current staking position in Balancer pools and any claimable rewards.

Usage:
  npx ts-node src/agent/readPositions.ts [options] [address]

Options:
  -h, --help                 Display this help message
  -m, --multiple             Read positions for multiple addresses
  --use-env                  Use the wallet address from PRIVATE_KEY in .env
  
Examples:
  # Read position for specific address
  npx ts-node src/agent/readPositions.ts 0xYourAddress

  # Read position using private key in .env
  npx ts-node src/agent/readPositions.ts --use-env

  # Read positions for multiple addresses
  npx ts-node src/agent/readPositions.ts --multiple 0xAddress1 0xAddress2 0xAddress3

  # Display help
  npx ts-node src/agent/readPositions.ts --help
  `);
}

// Run the function if script is executed directly
if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  // Show help if requested or no arguments
  if (args.includes('--help') || args.includes('-h')) {
    displayHelp();
    process.exit(0);
  }
  
  if (args.length === 0 || args.includes('--use-env')) {
    // No arguments provided, use the wallet from PRIVATE_KEY
    readStakingPosition()
      .then(result => {
        // Create a data directory if it doesn't exist
        const dataDir = './data';
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save results to a file
        const resultFile = `${dataDir}/position.json`;
        fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
        console.log(`Position data saved to ${resultFile}`);
      })
      .catch(error => {
        console.error(`Failed to read position: ${error.message}`);
        process.exit(1);
      });
  } else if (args[0] === '--multiple' || args[0] === '-m') {
    // Multiple addresses mode
    const addresses = args.slice(1);
    if (addresses.length === 0) {
      console.error('No addresses provided for multiple mode. Usage: npx ts-node src/agent/readPositions.ts --multiple <address1> <address2> ...');
      process.exit(1);
    }
    
    readMultiplePositions(addresses)
      .catch(error => {
        console.error(`Failed to read multiple positions: ${error.message}`);
        process.exit(1);
      });
  } else {
    // Single address provided
    const userAddress = args[0];
    
    readStakingPosition(userAddress)
      .then(result => {
        // Create a data directory if it doesn't exist
        const dataDir = './data';
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save results to a file
        const resultFile = `${dataDir}/position.json`;
        fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
        console.log(`Position data saved to ${resultFile}`);
      })
      .catch(error => {
        console.error(`Failed to read position: ${error.message}`);
        process.exit(1);
      });
  }
}

export { readStakingPosition, readMultiplePositions };

/**
 * Get all staking positions for a specific address
 */
export async function getPositionsForAddress(address: string): Promise<any[]> {
  // Use existing readPositions logic but for a specific address
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
    
    // Get gauge controller address
    const gaugeControllerAddress = '0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD';
    
    // ABI for gauge controller
    const gaugeControllerABI = [
      'function gauge_types(address gauge) external view returns (int128)'
    ];
    
    // ABI for gauge
    const gaugeABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function reward_tokens(uint256 index) external view returns (address)',
      'function claimable_reward(address user, address token) external view returns (uint256)',
      'function reward_data(address token) external view returns (tuple(address,address,uint256,uint256,uint256,uint256))'
    ];
    
    // ABI for pool token
    const poolTokenABI = [
      'function symbol() external view returns (string)'
    ];
    
    console.log(`Checking positions for address: ${address}`);

    // If we have a multi-address file, read all gauges
    const allGauges = await getAllGauges();
    
    // Check each gauge
    const positions = [];
    
    for (const gauge of allGauges) {
      try {
        const gaugeContract = new ethers.Contract(gauge.address, gaugeABI, provider);
        
        // Check balance of user in this gauge
        const balance = await gaugeContract.balanceOf(address);
        
        // Only include positions with non-zero balance
        if (balance > 0n) {
          // Get pool token info
          let symbol = "Unknown";
          try {
            if (gauge.poolAddress) {
              const poolToken = new ethers.Contract(gauge.poolAddress, poolTokenABI, provider);
              symbol = await poolToken.symbol();
            } else {
              symbol = gauge.name || "Unknown";
            }
          } catch (error) {
            console.warn(`Error getting symbol for gauge ${gauge.address}: ${error}`);
          }
          
          // Add to positions
          positions.push({
            gauge: gauge.address,
            balance: ethers.formatEther(balance),
            symbol: symbol,
            poolAddress: gauge.poolAddress || 'Unknown'
          });
        }
      } catch (error) {
        console.warn(`Error checking gauge ${gauge.address}: ${error}`);
      }
    }
    
    console.log(`Found ${positions.length} positions for ${address}`);
    return positions;
  } catch (error) {
    console.error('Error getting positions:', error);
    throw error;
  }
}

/**
 * Helper function to get all gauges
 */
async function getAllGauges() {
  // Load from Balancer gauges data
  try {
    const { getGauges } = require('../utils/balancerUtils');
    return await getGauges();
  } catch (error) {
    console.error('Failed to load gauges:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    // Get wallet address and refresh parameter from the query
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('address');
    const refresh = url.searchParams.get('refresh');
    
    // Use default address if not provided
    const addressToUse = walletAddress || '0x4Aa0B81F700b7053F98eD21e704B25F1A4A52e69';
    
    console.log(`Fetching position for address: ${addressToUse}, refresh=${refresh}`);
    
    try {
      // Path to position cache file
      const dataDir = path.resolve(process.cwd(), 'data');
      const positionFile = path.join(dataDir, 'position.json');
      
      // Only use cache if refresh is not set and cache exists
      if (!refresh && fs.existsSync(positionFile)) {
        console.log(`Using cached position data from ${positionFile}`);
        // Read and parse the position data
        const positionData = JSON.parse(fs.readFileSync(positionFile, 'utf8'));
        // Return the cached position data
        return NextResponse.json(positionData);
      }
      
      // Otherwise, get fresh data
      console.log(`Getting fresh position data for ${addressToUse}`);
      const positionData = await readStakingPosition(addressToUse);
      
      // Make sure data directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Save the fresh data to the cache file
      fs.writeFileSync(positionFile, JSON.stringify(positionData, null, 2));
      console.log(`Saved fresh position data to ${positionFile}`);
      
      // Return the position data
      return NextResponse.json(positionData);
    } catch (error) {
      console.error('Error fetching position:', error);
      return NextResponse.json(
        { error: 'Failed to fetch position data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in position API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}