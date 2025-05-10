import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

// Define types for gauge data
export interface RewardToken {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  price?: number;
}

export interface Gauge {
  address: string;
  name: string;
  poolAddress: string;
  poolName?: string;
  totalSupply?: string;
  workingSupply?: string;
  rewardTokens?: RewardToken[];
}

/**
 * Get all Balancer gauges with their data
 */
export async function getGauges(): Promise<Gauge[]> {
  // First try to load from cached file
  const gaugesFilePath = path.join(process.cwd(), 'data', 'gauges.json');
  
  try {
    if (fs.existsSync(gaugesFilePath)) {
      const gaugesData = JSON.parse(fs.readFileSync(gaugesFilePath, 'utf8'));
      return gaugesData;
    }
  } catch (error) {
    console.warn('Error loading gauges from cache:', error);
  }
  
  // If cache failed or doesn't exist, load from default dataset
  try {
    // Fetch gauge data from Balancer API
    const response = await axios.get('https://api.balancer.fi/v3/gauges');
    
    if (response.status === 200 && response.data) {
      const gauges: Gauge[] = response.data.data.map((g: any) => ({
        address: g.address,
        name: g.name || 'Unknown Gauge',
        poolAddress: g.pool?.address || '',
        poolName: g.pool?.name || '',
        totalSupply: g.totalSupply,
        workingSupply: g.workingSupply,
        rewardTokens: g.rewardTokens?.map((t: any) => ({
          tokenAddress: t.tokenAddress,
          symbol: t.symbol || 'Unknown Token',
          decimals: t.decimals || 18,
          price: t.price || 0
        })) || []
      }));
      
      // Save to cache file for future use
      if (!fs.existsSync(path.dirname(gaugesFilePath))) {
        fs.mkdirSync(path.dirname(gaugesFilePath), { recursive: true });
      }
      
      fs.writeFileSync(gaugesFilePath, JSON.stringify(gauges, null, 2));
      
      return gauges;
    }
    
    throw new Error(`Error fetching gauge data: ${response.status}`);
  } catch (error) {
    console.error('Failed to fetch gauges from API:', error);
    
    // Return empty array as fallback
    return [];
  }
}

/**
 * Format reward tokens and sum their USD values
 */
export function formatAndSumRewards(
  rewards: Record<string, Record<string, { amount: string; symbol: string; usdValue: number; }>>,
): { formattedRewards: any; totalUsdValue: number } {
  let totalUsdValue = 0;
  const formattedRewards: Record<string, { token: string; symbol: string; amount: string; usdValue: number }[]> = {};
  
  // Process each gauge's rewards
  Object.entries(rewards).forEach(([gauge, tokens]) => {
    formattedRewards[gauge] = [];
    
    // Process each token in this gauge
    Object.entries(tokens).forEach(([token, data]) => {
      formattedRewards[gauge].push({
        token,
        symbol: data.symbol,
        amount: data.amount,
        usdValue: data.usdValue
      });
      
      totalUsdValue += data.usdValue;
    });
  });
  
  return { formattedRewards, totalUsdValue };
} 