import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-opus-20240229';

// File paths
const DATA_DIR = path.resolve(__dirname, '../../data');
const GAUGES_FILE = path.join(DATA_DIR, 'gauges.json');
const POOLS_FILE = path.join(DATA_DIR, 'pools.json');
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const STRATEGY_FILE = path.join(DATA_DIR, `strategy_logs/strategy_${timestamp}.json`);

// Interfaces for our data
interface GaugeData {
  id: string;
  poolName: string;
  address: string;
  poolId: string;
  poolAddress: string;
  poolLiquidity: number;
  poolSwapFee: number;
  currentVotes: number;
  bribePerVEBAL: number;
  supply: {
    totalSupply: number;
    weekAgoSupply: number;
    supplyTrend: number;
  };
  rewards: {
    tokens: {
      address: string;
      symbol: string;
      rate: number;
      aprPercent?: number;
      historyRate?: number;
      rateChange?: number;
    }[];
  };
}

interface PoolData {
  id: string;
  type: string;
  poolTokens: {
    name: string;
  }[];
  dynamicData: {
    totalLiquidity: string;
    aggregateSwapFee: string;
    yieldCapture24h: string;
    yieldCapture48h: string;
    fees48h: string;
    swapFee: string;
    aggregateYieldFee: string;
    volume48h: string;
    totalShares24hAgo: string;
    totalLiquidity24hAgo: string;
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

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StrategyRecommendation {
  poolName: string;
  allocation: number;
  gaugeAddress: string;
  estAPR: number;
  score: number;
  rationale: string;
}

/**
 * Call Claude API with a prompt
 */
async function callClaudeApi(prompt: string): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY environment variable is not set');
  }

  try {
    console.log('Calling Claude API...');
    
    const messages: ClaudeMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: CLAUDE_MODEL,
        messages,
        max_tokens: 4000,
        temperature: 0.2
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'messages-2023-12-15'
        }
      }
    );

    if (response.data.content && Array.isArray(response.data.content) && response.data.content.length > 0) {
      return response.data.content[0].text;
    } else {
      console.error('Unexpected response format:', JSON.stringify(response.data, null, 2));
      return "Error: Unexpected response format from Claude API";
    }
  } catch (error) {
    console.error('Error calling Claude API:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error('Failed to get response from Claude API');
  }
}

/**
 * Prepare a detailed analysis of pools and gauges for Claude
 */
function prepareAnalysisPrompt(gauges: GaugeData[], pools: PoolData[]): string {
  console.log(`Preparing analysis for ${gauges.length} gauges and ${pools.length} pools`);
  
  // Create a map of pools by ID for quick reference
  const poolsMap = new Map<string, PoolData>();
  pools.forEach(pool => {
    poolsMap.set(pool.id.toLowerCase(), pool);
  });
  
  // Enhanced pool summary
  const allPoolsSummary = pools.map(pool => {
    const hasGauge = pool.staking?.gauge != null;
    const gaugeAddress = pool.staking?.gauge?.gaugeAddress || 'None';
    const composition = pool.poolTokens.map(t => t.name).join('/');
    const liquidity = parseFloat(pool.dynamicData.totalLiquidity).toLocaleString();
    const liquidityChange = pool.dynamicData.totalLiquidity24hAgo && pool.dynamicData.totalLiquidity ? 
      ((parseFloat(pool.dynamicData.totalLiquidity) / parseFloat(pool.dynamicData.totalLiquidity24hAgo) - 1) * 100).toFixed(2) + '%' :
      'Unknown';
    const swapFee = (parseFloat(pool.dynamicData.swapFee) * 100).toFixed(4);
    const volume = parseFloat(pool.dynamicData.volume48h || '0').toLocaleString();
    const fees48h = parseFloat(pool.dynamicData.fees48h || '0').toLocaleString();
    const yieldCapture = parseFloat(pool.dynamicData.yieldCapture48h || '0').toLocaleString();
    
    // Format APR items if available
    const aprItems = pool.dynamicData.aprItems?.map(item => 
      `${item.rewardTokenSymbol}: ${parseFloat(item.apr).toFixed(2)}%`
    ).join(', ') || 'None';
    
    return `
      Pool: ${composition}
      ID: ${pool.id}
      Type: ${pool.type}
      Has Gauge: ${hasGauge ? 'Yes' : 'No'}
      Gauge Address: ${gaugeAddress}
      Liquidity: $${liquidity} (24h Change: ${liquidityChange})
      Swap Fee: ${swapFee}%
      Volume (48h): $${volume}
      Fees (48h): $${fees48h}
      Yield Capture (48h): $${yieldCapture}
      APR Items: ${aprItems}
    `;
  }).join('\n---\n');
  
  // Enhanced gauge details
  const gaugeDetails = gauges.map(gauge => {
    const pool = poolsMap.get(gauge.poolId.toLowerCase());
    
    // Calculate volume APR
    let volumeApr = 0;
    if (pool) {
      const volume48h = parseFloat(pool.dynamicData.volume48h || '0');
      const liquidity = parseFloat(pool.dynamicData.totalLiquidity || '0');
      const swapFee = parseFloat(pool.dynamicData.swapFee || '0');

      if (liquidity > 0) {
        volumeApr = (volume48h * swapFee * 365 / 2) / liquidity * 100;
      }
    }
    
    // Calculate total reward APR
    let totalRewardApr = 0;
    gauge.rewards.tokens.forEach(token => {
      if (token.aprPercent) {
        totalRewardApr += token.aprPercent;
      }
    });
    
    // Format reward tokens with more details
    const rewardDetails = gauge.rewards.tokens.map(token => {
      const rateChange = token.rateChange ? 
        ` (${token.rateChange > 0 ? '+' : ''}${token.rateChange.toFixed(2)}% change)` : '';
      return `${token.symbol}: ${token.rate.toFixed(6)} tokens/sec${token.aprPercent ? ` (${token.aprPercent.toFixed(2)}% APR)` : ''}${rateChange}`;
    }).join(', ');
    
    // Format pool composition
    const poolComposition = pool ? 
      pool.poolTokens.map(t => t.name).join('/') : 
      'Unknown composition';
    
    // Format supply details
    const totalSupply = gauge.supply.totalSupply.toLocaleString();
    const weekAgoSupply = gauge.supply.weekAgoSupply.toLocaleString();
    const supplyTrend = gauge.supply.supplyTrend.toFixed(2);
    
    return `
      Pool: ${gauge.poolName}
      Composition: ${poolComposition}
      GaugeAddress: ${gauge.address}
      PoolId: ${gauge.poolId}
      PoolAddress: ${gauge.poolAddress}
      Liquidity: $${gauge.poolLiquidity.toLocaleString()}
      Current Votes: ${gauge.currentVotes.toFixed(4)} (${(gauge.currentVotes * 100).toFixed(2)}%)
      Swap Fee: ${(gauge.poolSwapFee * 100).toFixed(4)}%
      Volume APR: ${volumeApr.toFixed(2)}%
      Total APR: ${(totalRewardApr + volumeApr).toFixed(2)}%
      Reward Per Vote: ${gauge.currentVotes > 0 ? (totalRewardApr / gauge.currentVotes).toFixed(4) : 'N/A'}
      Bribe Per veBAL: ${gauge.bribePerVEBAL.toFixed(6)}
      Supply: Current ${totalSupply}, Week Ago ${weekAgoSupply}, Trend ${supplyTrend}%
      Rewards: ${rewardDetails || 'None'}
    `;
  }).join('\n---\n');
  
/*   // Add summary statistics
  const statsSection = `
      SUMMARY STATISTICS:
      - Total number of pools analyzed: ${gauges.length}
      - Average pool liquidity: $${(gauges.reduce((sum, g) => sum + g.poolLiquidity, 0) / gauges.length).toLocaleString()}
      - Average APR from rewards: ${(gauges.reduce((sum, g) => {
    let totalApr = 0;
    g.rewards.tokens.forEach(t => {
      if (t.aprPercent) totalApr += t.aprPercent;
    });
    return sum + totalApr;
  }, 0) / gauges.length).toFixed(2)}%
  - Highest liquidity pool: ${gauges.sort((a, b) => b.poolLiquidity - a.poolLiquidity)[0]?.poolName || 'N/A'} ($${gauges.sort((a, b) => b.poolLiquidity - a.poolLiquidity)[0]?.poolLiquidity?.toLocaleString() || 0})
  - Most voted pool: ${gauges.sort((a, b) => b.currentVotes - a.currentVotes)[0]?.poolName || 'N/A'} (${(gauges.sort((a, b) => b.currentVotes - a.currentVotes)[0]?.currentVotes * 100)?.toFixed(2) || 0}%)
`; */
  
  // Build the full prompt
  return `You are a DeFi strategist helping users allocate capital across Balancer liquidity pools.
    The user will add liquidity and stake their LP tokens to earn both swap fees and reward incentives.

    Your goal is to recommend 3-5 pools for this user to maximize yield while avoiding oversaturated pools and maintaining risk diversification.

    Please analyze the following pools and return a JSON strategy recommendation. Your strategy should prioritize:
    - High total APR (from volume + rewards)
    - Strong reward-per-vote (RPV)
    - High TVL and trading activity (liquidity/volume)
    - Sustainable supply growth or demand (supply trend)
    - Reasonable distribution of votes (don't pile into overcrowded gauges)
    - Pool diversification (not all stablecoins, or all ETH etc.)

    Here is how to interpret the data:
    - **Liquidity**: high liquidity means stability, but lower per-user rewards
    - **Swap Fee & Volume APR**: shows real trading activity, a core source of yield
    - **Reward APR**: shows protocol-level incentives for LPs
    - **Reward Per Vote**: if the user wants to vote with veBAL, this indicates vote efficiency
    - **Supply Trend**: indicates whether participation is growing (a bullish signal)

    Consider trade-offs:
    - Too high liquidity = diluted APR
    - Too low liquidity = volatile or unsustainable pool

    Give your final strategy in this JSON format:

    STRATEGY: [
      {
        "poolName": "Name",
        "allocation": 25, // percentage allocation (all must sum to 100%)
        "poolAddress": "0x123...", // the pool address
        "estAPR": 12.5, // estimated APR percentage from rewards and fees
        "score": 85, // your score from 0-100 on quality of this allocation
        "rationale": "Brief reason why this pool is recommended"
      },
      // additional pools...
    ]

    Here's the data:

    ${gaugeDetails}

    ${allPoolsSummary}

    Please analyze this data, think about the trade-offs and APR composition, and provide a strategic allocation, formatted exactly as requested, to maximize returns. For each recommendation, explain the rationale briefly, including estimated APR and your confidence in that pool (expressed as the score from 0-100).

    Remember to format your final recommendation as STRATEGY: followed by the JSON array.`;
}

/**
 * Extract the strategy recommendation from Claude's response
 */
function extractStrategy(response: string): StrategyRecommendation[] | null {
  try {
    // Look for the STRATEGY: marker
    const strategyMatch = response.match(/STRATEGY:\s*(\[[\s\S]*?\])/);
    if (strategyMatch && strategyMatch[1]) {
      // Parse the JSON array
      const strategyJson = strategyMatch[1];
      return JSON.parse(strategyJson);
    }
    return null;
  } catch (error) {
    console.error('Error extracting strategy:', error);
    return null;
  }
}

/**
 * Main function to analyze gauges and generate a strategy
 */
async function analyzeAndGenerateStrategy(): Promise<void> {
  try {
    console.log("Starting analysis and strategy generation...");
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Ensure strategy_logs directory exists
    const strategyLogsDir = path.join(DATA_DIR, 'strategy_logs');
    if (!fs.existsSync(strategyLogsDir)) {
      fs.mkdirSync(strategyLogsDir, { recursive: true });
    }
    
    // Check if required data files exist
    if (!fs.existsSync(GAUGES_FILE) || !fs.existsSync(POOLS_FILE)) {
      console.error("Gauge or pool data not found. Please run fetchGaugeData.ts first.");
      return;
    }
    
    // Load gauge and pool data
    const gauges: GaugeData[] = JSON.parse(fs.readFileSync(GAUGES_FILE, 'utf8'));
    const pools: PoolData[] = JSON.parse(fs.readFileSync(POOLS_FILE, 'utf8'));
    
    console.log(`Loaded ${gauges.length} gauges and ${pools.length} pools`);
    
    // Prepare analysis prompt
    const prompt = prepareAnalysisPrompt(gauges, pools);
    
    // Call Claude API
    const response = await callClaudeApi(prompt);
    
    // Extract strategy from response
    const strategy = extractStrategy(response);
    
    if (strategy) {
      console.log("Successfully extracted strategy recommendation:");
      console.log(JSON.stringify(strategy, null, 2));
      
      // Save full response and extracted strategy to timestamped file
      fs.writeFileSync(STRATEGY_FILE, JSON.stringify({
        timestamp: new Date().toISOString(),
        strategy,
        fullResponse: response
      }, null, 2));
      
      // Also save to the standard strategy.json file for compatibility
      fs.writeFileSync(path.join(DATA_DIR, 'strategy.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        strategy,
        fullResponse: response
      }, null, 2));
      
      console.log(`Strategy saved to ${STRATEGY_FILE} and ${path.join(DATA_DIR, 'strategy.json')}`);
    } else {
      console.error("Failed to extract strategy from response");
      fs.writeFileSync(STRATEGY_FILE, JSON.stringify({
        timestamp: new Date().toISOString(),
        error: "Failed to extract strategy",
        fullResponse: response
      }, null, 2));
    }
    
  } catch (error) {
    console.error("Error analyzing and generating strategy:", error);
  }
}

// Run this module directly if called from command line
if (require.main === module) {
  analyzeAndGenerateStrategy().then(() => {
    console.log('Analysis and strategy generation completed');
  }).catch(error => {
    console.error('Error in analyzeAndGenerateStrategy:', error);
    process.exit(1);
  });
}

export default analyzeAndGenerateStrategy;
