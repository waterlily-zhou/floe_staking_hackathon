import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// Type definitions
interface Pool {
  poolName: string;
  gaugeAddress: string;
  chain: string;
  allocationPercentage: number;
  totalAPR: string;
  recommendationScore: string;
  rationale: string;
}

interface Strategy {
  generatedAt: string;
  recommendedPools: Pool[];
  aiRecommendations?: string;
}

// Contract ABIs
const GAUGE_ABI = [
  "function balanceOf(address user) external view returns (uint256)",
  "function deposit(uint256 value) external",
  "function withdraw(uint256 value) external"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Initialize provider and wallet from environment variables
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
const wallet = process.env.PRIVATE_KEY 
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : null;

// File paths
const STRATEGY_FILE = path.join(process.cwd(), "data", "stakingStrategy.json");
const RESTAKE_LOG_FILE = path.join(process.cwd(), "data", "restake_logs", `restake_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

/**
 * Main function to restake according to strategy
 */
export async function restakeOnly(isMockMode = true, walletAddress?: string, useDelegation = false, delegationContractAddress?: string): Promise<void> {
  // Ensure we have wallet configured when not in mock mode
  if (!isMockMode && !wallet && !walletAddress) {
    throw new Error("PRIVATE_KEY environment variable must be set for actual blockchain transactions or wallet address must be provided");
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🤖 AUTO-COMPOUND AI: RESTAKE AGENT ${isMockMode ? "(MOCK MODE)" : ""}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // If wallet address is provided, log it
  if (walletAddress) {
    console.log(`Using provided wallet address: ${walletAddress}`);
  }
  
  // If using delegation, log it
  if (useDelegation) {
    console.log(`Using delegation for executing transactions`);
    if (delegationContractAddress) {
      console.log(`Delegation contract: ${delegationContractAddress}`);
    }
  }
  
  // Load the latest strategy
  const strategy = loadStrategy();
  console.log(`📊 Loaded strategy generated at: ${strategy.generatedAt}`);
  console.log(`📊 Strategy recommends ${strategy.recommendedPools.length} pools\n`);
  
  const restakeLog = {
    timestamp: new Date().toISOString(),
    isMockMode,
    strategy: {
      generatedAt: strategy.generatedAt,
      recommendedPools: strategy.recommendedPools.map(p => ({ 
        poolName: p.poolName, 
        gaugeAddress: p.gaugeAddress,
        allocationPercentage: p.allocationPercentage 
      }))
    },
    actions: [] as any[],
    summary: {
      totalRestaked: 0,
      errors: [] as string[]
    }
  };
  
  try {
    // Get currently staked positions for reallocation
    const currentPositions = await getCurrentPositions(isMockMode, walletAddress);
    console.log("🔍 CURRENT POSITIONS:");
    Object.entries(currentPositions).forEach(([gauge, amount]) => {
      console.log(`   ${formatGaugeName(gauge)}: ${ethers.formatEther(amount)} LP tokens`);
    });
    
    // Calculate reallocation plan
    console.log("\n📝 CALCULATING REALLOCATION PLAN...");
    const { unstakeActions, stakeActions } = calculateReallocationPlan(
      currentPositions, 
      strategy.recommendedPools
    );
    
    // Execute unstaking
    console.log("\n📤 EXECUTING UNSTAKE ACTIONS:");
    for (const action of unstakeActions) {
      console.log(`   Unstaking ${ethers.formatEther(action.amount)} LP tokens from ${formatGaugeName(action.gauge)}`);
      
      if (!isMockMode) {
        await executeUnstake(action.gauge, action.amount, walletAddress);
      }
      
      restakeLog.actions.push({
        type: "unstake",
        gaugeAddress: action.gauge,
        gaugeName: formatGaugeName(action.gauge),
        amount: action.amount.toString()
      });
    }
    
    // Execute staking
    console.log("\n📥 EXECUTING STAKE ACTIONS:");
    for (const action of stakeActions) {
      console.log(`   Staking ${ethers.formatEther(action.amount)} LP tokens into ${formatGaugeName(action.gauge)}`);
      
      if (!isMockMode) {
        await executeStake(action.gauge, action.amount, walletAddress);
      }
      
      restakeLog.actions.push({
        type: "stake",
        gaugeAddress: action.gauge,
        gaugeName: formatGaugeName(action.gauge),
        amount: action.amount.toString()
      });
    }
    
    // Calculate total restaked in USD (approximate)
    const totalRestakedUSD = stakeActions.reduce((sum, action) => 
      sum + parseFloat(ethers.formatEther(action.amount)) * 1000, 0); // Simple estimation
    
    restakeLog.summary.totalRestaked = totalRestakedUSD;
    
    console.log("\n✅ EXECUTION COMPLETED SUCCESSFULLY");
    console.log(`   Total USD value restaked: ~$${totalRestakedUSD.toFixed(2)}`);
  } catch (error) {
    console.error("❌ ERROR DURING EXECUTION:", error);
    restakeLog.summary.errors.push(String(error));
  }
  
  // Save restake log
  saveRestakeLog(restakeLog);
  console.log(`\n📝 Restake log saved to ${RESTAKE_LOG_FILE}`);
}

/**
 * Load the latest strategy from file
 */
function loadStrategy(): Strategy {
  try {
    if (!fs.existsSync(STRATEGY_FILE)) {
      throw new Error(`Strategy file not found at ${STRATEGY_FILE}`);
    }
    
    const strategyData = fs.readFileSync(STRATEGY_FILE, 'utf8');
    return JSON.parse(strategyData);
  } catch (error) {
    console.error(`Failed to load strategy: ${error}`);
    throw error;
  }
}

/**
 * Get current staked positions across all gauges
 */
async function getCurrentPositions(isMockMode = false, walletAddress?: string): Promise<Record<string, bigint>> {
  if (isMockMode) {
    return mockGetCurrentPositions();
  }
  
  if (!wallet && !walletAddress) throw new Error("Wallet not initialized");
  
  const userAddress = wallet ? await wallet.getAddress() : walletAddress;
  const positions: Record<string, bigint> = {};
  
  // Load strategy to get gauge addresses
  const strategy = loadStrategy();
  const gaugeAddresses = strategy.recommendedPools.map(pool => pool.gaugeAddress);
  
  // Check balance in each gauge
  for (const gaugeAddress of gaugeAddresses) {
    try {
      const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, wallet);
      const balance = await gauge.balanceOf(userAddress);
      positions[gaugeAddress] = balance;
    } catch (error) {
      console.warn(`Failed to get balance for gauge ${gaugeAddress}: ${error}`);
    }
  }
  
  return positions;
}

/**
 * Calculate the reallocation plan based on current positions and new strategy
 */
function calculateReallocationPlan(
  currentPositions: Record<string, bigint>,
  recommendedPools: Pool[]
): { 
  unstakeActions: Array<{gauge: string, amount: bigint}>,
  stakeActions: Array<{gauge: string, amount: bigint}>
} {
  const unstakeActions: Array<{gauge: string, amount: bigint}> = [];
  const stakeActions: Array<{gauge: string, amount: bigint}> = [];
  
  // Get total value currently staked (estimation)
  const totalCurrentValueEth = Object.values(currentPositions)
    .reduce((sum, amount) => sum + amount, 0n);
  
  // If nothing is staked, we can't perform reallocation
  if (totalCurrentValueEth === 0n) {
    console.log("   No current positions to reallocate. Please stake manually first.");
    return { unstakeActions, stakeActions };
  }
  
  // Create mapping of gauge address to target allocation percentage
  const targetAllocations: Record<string, number> = {};
  for (const pool of recommendedPools) {
    targetAllocations[pool.gaugeAddress] = pool.allocationPercentage;
  }
  
  // Calculate which gauges need to be unstaked (no longer recommended or reduced allocation)
  for (const [gauge, currentAmount] of Object.entries(currentPositions)) {
    if (currentAmount === 0n) continue;
    
    const targetPercentage = targetAllocations[gauge] || 0;
    const targetAmount = (totalCurrentValueEth * BigInt(targetPercentage)) / 100n;
    
    if (targetAmount < currentAmount) {
      // Need to unstake some or all
      const amountToUnstake = currentAmount - targetAmount;
      
      if (amountToUnstake > 0n) {
        unstakeActions.push({
          gauge,
          amount: amountToUnstake
        });
      }
    }
  }
  
  // Calculate which gauges need more stake
  for (const pool of recommendedPools) {
    const gauge = pool.gaugeAddress;
    const currentAmount = currentPositions[gauge] || 0n;
    const targetAmount = (totalCurrentValueEth * BigInt(pool.allocationPercentage)) / 100n;
    
    if (targetAmount > currentAmount) {
      // Need to stake more
      const amountToStake = targetAmount - currentAmount;
      
      if (amountToStake > 0n) {
        stakeActions.push({
          gauge,
          amount: amountToStake
        });
      }
    }
  }
  
  // Log the reallocation plan
  console.log(`   Total currently staked: ${ethers.formatEther(totalCurrentValueEth)} LP tokens`);
  console.log("   Unstake actions:");
  unstakeActions.forEach(action => {
    console.log(`     - Unstake ${ethers.formatEther(action.amount)} LP tokens from ${formatGaugeName(action.gauge)}`);
  });
  
  console.log("   Stake actions:");
  stakeActions.forEach(action => {
    console.log(`     - Stake ${ethers.formatEther(action.amount)} LP tokens into ${formatGaugeName(action.gauge)}`);
  });
  
  return { unstakeActions, stakeActions };
}

/**
 * Execute unstaking from a gauge
 */
async function executeUnstake(gaugeAddress: string, amount: bigint, walletAddress?: string): Promise<void> {
  if (!wallet && !walletAddress) throw new Error("Wallet not initialized");
  
  const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, wallet);
  
  try {
    const tx = await gauge.withdraw(amount);
    await tx.wait();
    console.log(`   Successfully unstaked from ${formatGaugeName(gaugeAddress)}`);
  } catch (error) {
    console.error(`   Failed to unstake from ${formatGaugeName(gaugeAddress)}: ${error}`);
    throw error;
  }
}

/**
 * Execute staking into a gauge
 */
async function executeStake(gaugeAddress: string, amount: bigint, walletAddress?: string): Promise<void> {
  if (!wallet && !walletAddress) throw new Error("Wallet not initialized");
  
  const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, wallet);
  
  try {
    // In a real implementation, we'd need to:
    // 1. Get the LP token address for this gauge
    // 2. Approve the gauge to spend our LP tokens
    // 3. Call deposit
    
    // For simplicity, assuming approval is already done
    const tx = await gauge.deposit(amount);
    await tx.wait();
    console.log(`   Successfully staked into ${formatGaugeName(gaugeAddress)}`);
  } catch (error) {
    console.error(`   Failed to stake into ${formatGaugeName(gaugeAddress)}: ${error}`);
    throw error;
  }
}

/**
 * Save restake log to file
 */
function saveRestakeLog(log: any): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(RESTAKE_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(RESTAKE_LOG_FILE, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error(`Failed to save restake log: ${error}`);
  }
}

/**
 * Format gauge address to a readable name (if available)
 */
function formatGaugeName(gaugeAddress: string): string {
  try {
    const strategy = loadStrategy();
    const pool = strategy.recommendedPools.find(p => p.gaugeAddress === gaugeAddress);
    return pool ? pool.poolName : gaugeAddress.substring(0, 6) + '...' + gaugeAddress.substring(38);
  } catch (error) {
    return gaugeAddress.substring(0, 6) + '...' + gaugeAddress.substring(38);
  }
}

// If this file is run directly, execute the agent in mock mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const isMockMode = args.includes('--mock') || !args.includes('--live');
  
  // Extract address parameter
  const addressArg = args.find(arg => arg.startsWith('--address='));
  const walletAddress = addressArg ? addressArg.split('=')[1] : undefined;
  
  // Extract delegation parameters
  const useDelegation = args.includes('--use-delegation') || args.includes('--delegation');
  const delegationArg = args.find(arg => arg.startsWith('--delegation-contract='));
  const delegationContractAddress = delegationArg ? delegationArg.split('=')[1] : undefined;
  
  restakeOnly(isMockMode, walletAddress, useDelegation, delegationContractAddress)
    .then(() => {
      console.log("\nRestake operation completed.");
      process.exit(0);
    })
    .catch(error => {
      console.error("\nRestake operation failed:", error);
      process.exit(1);
    });
}

export default restakeOnly; 