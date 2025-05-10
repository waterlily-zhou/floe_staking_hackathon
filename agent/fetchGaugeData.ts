// src/agent/fetchGaugeData.ts
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const subgraphApiKey = process.env.SUBGRAPH_API_KEY;

// Updated to use the correct Balancer Gauges subgraph for Arbitrum
const BALANCER_GAUGES_SUBGRAPH = `https://api.studio.thegraph.com/query/75376/balancer-gauges-arbitrum/version/latest`;

// Updated to use the correct Balancer Pools subgraph for Arbitrum
const BALANCER_POOLS_SUBGRAPH = `https://api.studio.thegraph.com/query/75376/balancer-pools-v3/version/latest`;

// Balancer API endpoint for getting pool data and voting data
const BALANCER_API_URL = 'https://api-v3.balancer.fi/graphql';

// Define the path where we'll save our data
const DATA_DIR = path.resolve(process.cwd(), 'data');
const GAUGES_FILE = path.join(DATA_DIR, 'gauges.json');
const POOLS_FILE = path.join(DATA_DIR, 'pools.json');
const POOLS_PLUS_VOTES_FILE = path.join(DATA_DIR, 'pools_plus_votes.json');

// Define the interfaces for our data
export interface FormattedGaugeData {
  id: string;
  address: string;
  poolName: string;
  poolAddress: string;
  poolId: string;
  poolLiquidity: number;
  poolSwapFee: number;
  currentVotes: number; // Vote percentage, i.e. 0.05 for 5%
  bribePerVEBAL: number; // Protocol-wide multiplier
  supply: {
    totalSupply: number;
    weekAgoSupply: number;
    supplyTrend: number; // % weekly change in supply
  };
  rewards: {
    tokens: {
      address: string;
      symbol: string;
      rate: number; // Tokens per second
      aprPercent?: number;
      historyRate?: number; // Historical rate from a previous period
      rateChange?: number; // % change in rate
    }[];
  };
}

// New interface for Balancer API pool data
interface BalancerApiPoolData {
  id: string;
  type: string;
  poolTokens: {
    name: string;
  }[];
  dynamicData: {
    totalLiquidity: string;
    aggregateSwapFee: string;
    aggregateYieldFee: string;
    volume48h: string;
    totalShares24hAgo: string;
    protocolFees48h: string;
    protocolYieldCapture48h: string;
    aprItems: {
      apr: string;
      rewardTokenSymbol: string;
    }[];
  };
  staking?: {
    gauge?: {
      gaugeAddress: string;
      rewards: {
        id: string;
        rewardPerSecond: string;
      }[];
      workingSupply: string;
    };
  };
}

interface BalancerApiVotingGauge {
  id: string;
  address: string;
  chain: string; 
  type: string;
  gauge: {
    address: string;
    relativeWeight: string;
  };
  tokens: {
    symbol: string;
  }[];
}

// Function to fetch voting data from Balancer API
async function fetchVotingData(): Promise<BalancerApiVotingGauge[]> {
  try {
    const response = await axios.post('https://api-v3.balancer.fi/graphql', {
      query: `
        query {
          veBalGetVotingList(includeKilled: false){
            id
            address
            chain
            type
            gauge {
              address
              relativeWeight
            }
            tokens {
              symbol
            }
          }
        }
      `
    });

    if (response.data.errors) {
      console.error('Error in Balancer API response:', response.data.errors);
      return [];
    }

    return response.data.data.veBalGetVotingList;
  } catch (error) {
    console.error('Error fetching voting data from Balancer API:', error);
    return [];
  }
}

// Function to fetch pool data from Balancer API
async function fetchPoolsFromBalancerApi(chain: 'MAINNET', limit = 50): Promise<BalancerApiPoolData[]> {
  try {
    console.log(`Fetching pool data from Balancer API for ${chain}...`);
    
    const poolQuery = `
    query {
      poolGetPools(
        where: {
          chainIn: ${chain},
        }
        first: ${limit}
        orderBy: totalLiquidity
      ) {
        id
        type
        poolTokens {
          name
        }
        dynamicData {
          totalLiquidity
          aggregateSwapFee
          aggregateYieldFee
          volume48h
          totalShares24hAgo
          protocolFees48h
          protocolYieldCapture48h
          aprItems {
            apr
            rewardTokenSymbol
          }
        }
        staking {
          gauge {
            gaugeAddress
            rewards {
              id
              rewardPerSecond
            }
            workingSupply
          }
        }
      }
    }`;

    const response = await axios.post(BALANCER_API_URL, { query: poolQuery });
    
    if (response.data.errors) {
      console.error('Error in Balancer API pools response:', response.data.errors);
      return [];
    }

    const pools = response.data.data.poolGetPools || [];
    console.log(`Fetched ${pools.length} pools from Balancer API for ${chain}`);
    
    // Save raw pool data to file
    fs.writeFileSync(POOLS_FILE, JSON.stringify(pools, null, 2));
    console.log(`Saved raw pool data to ${POOLS_FILE}`);
    
    return pools;
  } catch (error) {
    console.error('Error fetching pool data from Balancer API:', error);
    return [];
  }
}

// Function to fetch gauge data from the Balancer API and subgraph
export async function fetchGaugeData(limit = 50) {
  console.log(`Fetching gauge data from Balancer API...`);
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    // Step 1: Fetch voting data from Balancer API
    console.log('Fetching voting data from Balancer API...');
    const votingData = await fetchVotingData();
    const votingMap = new Map<string, {
      relativeWeight: number, 
      id: string,
      chain: string,
      tokens: { symbol: string }[],
      address: string
    }>();
    
    // Process voting data
    votingData.forEach(gauge => {
      // Convert relative weight to percentage (0-1)
      const relativeWeight = parseFloat(gauge.gauge?.relativeWeight || '0');
      
      const voteInfo = {
        relativeWeight, 
        id: gauge.id,
        chain: gauge.chain,
        tokens: gauge.tokens,
        address: gauge.address
      };
      
      // Index by gauge address
      if (gauge.gauge && gauge.gauge.address) {
        votingMap.set(gauge.gauge.address.toLowerCase(), voteInfo);
      }
      
      // Also index by pool address if available
      if (gauge.address) {
        votingMap.set(gauge.address.toLowerCase(), voteInfo);
      }
    });
    
    console.log(`Processed ${votingMap.size} voting gauges with valid addresses`);

    // Step 2: Fetch pool data from Balancer API
    console.log('Fetching pool data from Balancer API...');
    const apiPools = await fetchPoolsFromBalancerApi('MAINNET', limit);
    console.log(`Fetched ${apiPools.length} pools from Balancer API`);
    
    // Step 3: Combine the data - create formatted gauges directly from API pools
    const formattedGauges: FormattedGaugeData[] = [];
    
    for (const pool of apiPools) {
      // Skip pools without staking/gauge data
      if (!pool.staking?.gauge?.gaugeAddress) {
        continue;
      }
      
      const gaugeAddress = pool.staking.gauge.gaugeAddress.toLowerCase();
      
      // Try to find vote data for this gauge
      const voteData = votingMap.get(gaugeAddress) || votingMap.get(pool.id.toLowerCase());
      const currentVotes = voteData ? voteData.relativeWeight : 0;
      
      // Get pool tokens
      const poolTokenNames = pool.poolTokens.map(token => token.name).join('-');
      const poolName = poolTokenNames || `Pool-${pool.id.slice(0, 8)}`;
      
      // Format rewards data
      const rewardsTokens = pool.staking.gauge.rewards.map(reward => {
        // Try to find APR information
        let aprPercent = undefined;
        if (pool.dynamicData.aprItems && pool.dynamicData.aprItems.length > 0) {
          // Try to match reward with APR item
          const aprItem = pool.dynamicData.aprItems.find(
            item => item.rewardTokenSymbol && reward.id.includes(item.rewardTokenSymbol.toLowerCase())
          );
          if (aprItem) {
            aprPercent = parseFloat(aprItem.apr) * 100; // Convert to percentage
          }
        }
        
        return {
          address: reward.id,
          symbol: reward.id.split('-')[0] || 'Unknown', // Extract symbol from ID if possible
          rate: parseFloat(reward.rewardPerSecond) || 0,
          aprPercent,
          historyRate: 0, // We don't have historical data from this API
          rateChange: 0 // We don't have historical data from this API
        };
      });
      
      // Get pool information
      const poolLiquidity = parseFloat(pool.dynamicData.totalLiquidity) || 0;
      const poolSwapFee = parseFloat(pool.dynamicData.aggregateSwapFee) || 0;
      
      // Format gauge data
      const formattedGauge: FormattedGaugeData = {
        id: pool.id,
        address: gaugeAddress,
        poolName,
        poolAddress: pool.id,
        poolId: pool.id,
        poolLiquidity,
        poolSwapFee,
        currentVotes,
        bribePerVEBAL: 0, // Will be calculated later if needed
        supply: {
          totalSupply: parseFloat(pool.staking.gauge.workingSupply) || 0,
          weekAgoSupply: 0, // We don't have historical data from this API
          supplyTrend: 0 // We don't have historical data from this API
        },
        rewards: {
          tokens: rewardsTokens
        }
      };
      
      formattedGauges.push(formattedGauge);
    }
    
    console.log(`Processed ${formattedGauges.length} gauges with data from Balancer API`);
    
    // Save to file
    fs.writeFileSync(GAUGES_FILE, JSON.stringify(formattedGauges, null, 2));
    console.log(`Saved gauge data to ${GAUGES_FILE}`);
    
    return formattedGauges;
  } catch (error) {
    console.error('Error fetching gauge data:', error);
    throw error;
  }
}

// Run this module directly if called from command line
if (require.main === module) {
  fetchGaugeData(200).then(() => {
    console.log('Gauge data fetching completed');
  }).catch(error => {
    console.error('Error in fetchGaugeData:', error);
    process.exit(1);
  });
}

export default fetchGaugeData;
