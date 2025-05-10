import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// Define ABIs for necessary contracts
const GAUGE_ABI = [
  "function balanceOf(address user) external view returns (uint256)",
  "function deposit(uint256 value) external",
  "function withdraw(uint256 value) external",
  "function reward_count() external view returns (uint256)",
  "function reward_tokens(uint256 index) external view returns (address)",
  "function claimable_tokens(address user) external view returns (uint256)",
  "function claimable_reward(address user, address token) external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// Logs directory
const LOGS_DIR = path.join(process.cwd(), "data", "execution_logs");

// Initialize provider and wallet from environment variables
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
const wallet = process.env.PRIVATE_KEY 
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : null;

// Helper function to format amounts
function formatAmount(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

// Helper function to save execution logs
function saveExecutionLog(logData: any) {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Convert BigInt values to strings to avoid serialization issues
  const serializedData = JSON.stringify(logData, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const logFilePath = path.join(LOGS_DIR, `bpt_staking_${timestamp}.json`);
  fs.writeFileSync(logFilePath, serializedData);
  console.log(`\nExecution log saved to ${logFilePath}`);
  return logFilePath;
}

/**
 * Stake BPT tokens in a gauge
 * @param gaugeAddress The gauge address to stake in
 * @param poolTokenAddress The BPT token address of the pool
 * @param amountToStake Amount of BPT tokens to stake (or 'max' to use all available)
 * @param dryRun Whether to simulate transactions
 */
async function stakeLiquidityInGauge(
  gaugeAddress: string,
  poolTokenAddress: string,
  amountToStake: string = 'max',
  dryRun: boolean = false
) {
  if (!dryRun && !wallet) {
    throw new Error("PRIVATE_KEY environment variable must be set for actual blockchain transactions");
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 BALANCER GAUGE LIQUIDITY STAKING ${dryRun ? "(DRY RUN - NO TRANSACTIONS)" : "(LIVE MODE)"}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // Prepare execution log
  const executionLog: any = {
    timestamp: new Date().toISOString(),
    dryRun,
    gaugeAddress,
    poolTokenAddress,
    actions: [],
    errors: []
  };
  
  try {
    // 1. Connect to network
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    const address = dryRun ? "0xSimulatedAddress" : await wallet!.getAddress();
    console.log(`Wallet address: ${address}`);
    
    if (!dryRun) {
      const balance = await provider.getBalance(address);
      console.log(`ETH balance: ${formatAmount(balance, 18)} ETH\n`);
    }
    
    // 2. Verify contracts
    console.log("Verifying gauge contract...");
    const gaugeCode = await provider.getCode(gaugeAddress);
    if (gaugeCode === '0x') {
      throw new Error(`No contract found at gauge address ${gaugeAddress}`);
    }
    console.log("✅ Gauge contract verified");
    
    console.log("\nVerifying pool token contract...");
    const poolTokenCode = await provider.getCode(poolTokenAddress);
    if (poolTokenCode === '0x') {
      throw new Error(`No contract found at pool token address ${poolTokenAddress}`);
    }
    console.log("✅ Pool token contract verified");
    
    // 3. Connect to contracts
    const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, provider);
    const poolToken = new ethers.Contract(poolTokenAddress, ERC20_ABI, provider);
    
    // 4. Get token information
    const tokenSymbol = await poolToken.symbol();
    const tokenName = await poolToken.name();
    const tokenDecimals = await poolToken.decimals();
    
    console.log(`\nPool Token: ${tokenName} (${tokenSymbol})`);
    console.log(`Decimals: ${tokenDecimals}`);
    
    executionLog.tokenInfo = {
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals
    };
    
    // 5. Check current balances
    console.log("\nChecking balances...");
    
    let bptBalance = 0n;
    let currentlyStaked = 0n;
    
    if (!dryRun) {
      bptBalance = await poolToken.balanceOf(address);
      currentlyStaked = await gauge.balanceOf(address);
      
      console.log(`BPT Balance: ${formatAmount(bptBalance, tokenDecimals)} ${tokenSymbol}`);
      console.log(`Currently Staked: ${formatAmount(currentlyStaked, tokenDecimals)} ${tokenSymbol}`);
      
      executionLog.initialBalances = {
        bptBalance: formatAmount(bptBalance, tokenDecimals),
        stakedBalance: formatAmount(currentlyStaked, tokenDecimals)
      };
    } else {
      // For dry run, use example values
      console.log(`BPT Balance: 10.0 ${tokenSymbol} (simulated)`);
      console.log(`Currently Staked: 5.0 ${tokenSymbol} (simulated)`);
      
      executionLog.initialBalances = {
        bptBalance: "10.0",
        stakedBalance: "5.0"
      };
    }
    
    // 6. Calculate amount to stake
    let amountToStakeBN: bigint;
    
    if (!dryRun) {
      if (amountToStake.toLowerCase() === 'max') {
        amountToStakeBN = bptBalance;
        console.log(`\nUsing maximum available: ${formatAmount(amountToStakeBN, tokenDecimals)} ${tokenSymbol}`);
      } else {
        amountToStakeBN = ethers.parseUnits(amountToStake, tokenDecimals);
        
        if (amountToStakeBN > bptBalance) {
          console.log(`\n⚠️ Requested amount (${formatAmount(amountToStakeBN, tokenDecimals)}) exceeds available balance (${formatAmount(bptBalance, tokenDecimals)})`);
          console.log(`Using maximum available instead`);
          amountToStakeBN = bptBalance;
        } else {
          console.log(`\nAmount to stake: ${formatAmount(amountToStakeBN, tokenDecimals)} ${tokenSymbol}`);
        }
      }
      
      if (amountToStakeBN === 0n) {
        throw new Error(`No ${tokenSymbol} available to stake`);
      }
      
      executionLog.amountToStake = formatAmount(amountToStakeBN, tokenDecimals);
    } else {
      // For dry run, use example value
      console.log(`\nAmount to stake: 8.0 ${tokenSymbol} (simulated)`);
      executionLog.amountToStake = "8.0";
      amountToStakeBN = ethers.parseUnits("8.0", tokenDecimals);
    }
    
    // 7. Execute staking
    if (!dryRun) {
      // First approve tokens for gauge
      console.log("\nApproving tokens for gauge...");
      const poolTokenWithSigner = new ethers.Contract(poolTokenAddress, ERC20_ABI, wallet);
      
      // Check existing allowance
      const currentAllowance = await poolToken.allowance(address, gaugeAddress);
      
      if (currentAllowance >= amountToStakeBN) {
        console.log(`✅ Allowance already sufficient: ${formatAmount(currentAllowance, tokenDecimals)} ${tokenSymbol}`);
      } else {
        console.log(`Current allowance: ${formatAmount(currentAllowance, tokenDecimals)} ${tokenSymbol}`);
        console.log(`Approving ${formatAmount(amountToStakeBN, tokenDecimals)} ${tokenSymbol}...`);
        
        const approvalTx = await poolTokenWithSigner.approve(gaugeAddress, amountToStakeBN);
        console.log(`Approval transaction sent: ${approvalTx.hash}`);
        await approvalTx.wait();
        console.log("✅ Approval transaction confirmed");
        
        executionLog.actions.push({
          type: "approve",
          amount: formatAmount(amountToStakeBN, tokenDecimals),
          txHash: approvalTx.hash
        });
      }
      
      // Now stake tokens in gauge
      console.log("\nStaking tokens in gauge...");
      const gaugeWithSigner = new ethers.Contract(gaugeAddress, GAUGE_ABI, wallet);
      
      const stakeTx = await gaugeWithSigner.deposit(amountToStakeBN);
      console.log(`Stake transaction sent: ${stakeTx.hash}`);
      await stakeTx.wait();
      console.log("✅ Stake transaction confirmed");
      
      executionLog.actions.push({
        type: "stake",
        amount: formatAmount(amountToStakeBN, tokenDecimals),
        txHash: stakeTx.hash
      });
      
      // Verify final balances
      console.log("\nVerifying final balances...");
      const newBptBalance = await poolToken.balanceOf(address);
      const newStakedBalance = await gauge.balanceOf(address);
      
      console.log(`New BPT Balance: ${formatAmount(newBptBalance, tokenDecimals)} ${tokenSymbol}`);
      console.log(`New Staked Balance: ${formatAmount(newStakedBalance, tokenDecimals)} ${tokenSymbol}`);
      
      executionLog.finalBalances = {
        bptBalance: formatAmount(newBptBalance, tokenDecimals),
        stakedBalance: formatAmount(newStakedBalance, tokenDecimals)
      };
      
      const stakingSuccessful = newStakedBalance > currentlyStaked;
      
      if (stakingSuccessful) {
        console.log("\n✅ Staking successful!");
      } else {
        console.log("\n⚠️ Staking might have failed. Staked balance did not increase.");
        executionLog.errors.push("Staked balance did not increase after transaction");
      }
    } else {
      console.log("\n[DRY RUN] Would approve and stake tokens here");
      console.log("[DRY RUN] Would show updated balances here");
      
      executionLog.actions.push({
        type: "dryrun",
        message: "This was a dry run - no transactions were sent"
      });
      
      executionLog.finalBalances = {
        bptBalance: "2.0", // 10.0 - 8.0
        stakedBalance: "13.0" // 5.0 + 8.0
      };
    }
    
    // Save execution log
    const logPath = saveExecutionLog(executionLog);
    
    console.log("\n✅ Staking process completed successfully!");
    if (dryRun) {
      console.log("\nThis was a dry run. To execute actual transactions, run without the --dry-run flag.");
    }
    
    return { success: true, logPath };
  } catch (error: any) {
    console.error(`\n❌ Error in staking process: ${error.message || error}`);
    executionLog.errors.push(`Staking process failed: ${error.message || error}`);
    saveExecutionLog(executionLog);
    return { success: false, error: error.message || "Unknown error" };
  }
}

/**
 * Main function to run the staking tool
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let dryRun = false;
  let gaugeAddress = '';
  let poolTokenAddress = '';
  let amountToStake = 'max';
  
  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--gauge=')) {
      gaugeAddress = arg.split('=')[1];
    } else if (arg.startsWith('--pool-token=')) {
      poolTokenAddress = arg.split('=')[1];
    } else if (arg.startsWith('--amount=')) {
      amountToStake = arg.split('=')[1];
    }
  }
  
  if (!gaugeAddress) {
    throw new Error("Gauge address must be specified with --gauge=0x...");
  }
  
  if (!poolTokenAddress) {
    throw new Error("Pool token address must be specified with --pool-token=0x...");
  }
  
  if (!dryRun && !wallet) {
    throw new Error("PRIVATE_KEY environment variable must be set for live mode. Please add it to your .env file.");
  }
  
  // Normalize the addresses to checksum format
  try {
    gaugeAddress = ethers.getAddress(gaugeAddress);
    poolTokenAddress = ethers.getAddress(poolTokenAddress);
  } catch (error) {
    console.error(`Invalid address format`);
    throw error;
  }
  
  return await stakeLiquidityInGauge(gaugeAddress, poolTokenAddress, amountToStake, dryRun);
}

// Execute if run directly
if (require.main === module) {
  main()
    .then((result) => {
      if (result.success) {
        console.log("\nBalancer gauge staking completed successfully.");
        process.exit(0);
      } else {
        console.error("\nBalancer gauge staking failed:", result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error("\nUnhandled error:", error);
      process.exit(1);
    });
}

export { stakeLiquidityInGauge }; 