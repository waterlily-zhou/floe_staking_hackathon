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
exports.saveAutoClaimSettings = saveAutoClaimSettings;
exports.claimRewards = claimRewards;
exports.claimRewardsFromGauges = claimRewardsFromGauges;
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const readPositions_1 = require("./readPositions"); // Import from readPositions.ts
dotenv.config();
// Known tokens with descriptions
const KNOWN_TOKENS = {
    BAL: {
        address: "0xba100000625a3754423978a60c9317c58a424e3D",
        symbol: "BAL",
        name: "Balancer Governance Token",
        decimals: 18,
        price: 4.50, // Approximate price
        description: "Governance token for the Balancer protocol. Used for voting on protocol changes and parameter updates."
    },
    GHO: {
        address: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
        symbol: "GHO",
        name: "Aave GHO Stablecoin",
        decimals: 18,
        price: 0.98, // Approximate price
        description: "A decentralized stablecoin introduced by Aave, designed to maintain a soft peg to USD."
    },
    WETH: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        price: 1800, // Approximate price
        description: "ERC-20 token representation of Ether, allowing ETH to be used in smart contracts."
    }
};
// Contract ABIs
const GAUGE_ABI = [
    "function balanceOf(address user) external view returns (uint256)",
    "function claim_rewards(address user) external",
    "function claimable_reward(address user, address token) external view returns (uint256)",
    "function reward_tokens(uint256 index) external view returns (address)",
    "function reward_count() external view returns (uint256)"
];
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];
// Balancer contract addresses
const BAL_TOKEN = "0xba100000625a3754423978a60c9317c58a424e3D"; // Balancer governance token
const WETH_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Wrapped ETH
// Initialize provider and wallet from environment variables
const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
const wallet = process.env.PRIVATE_KEY
    ? new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;
// File paths
const CLAIM_LOG_FILE = path.join(process.cwd(), "data", "auto_claim_logs", `claim_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
// Gas price threshold for claims (in gwei)
const MAX_GAS_PRICE_GWEI = 100; // Don't claim if gas price is above 100 gwei
// Minimum reward value in USD to make claiming worth it
const MIN_REWARD_VALUE_USD = 1.0; // Minimum $1 to claim
// Auto claim settings storage file
const AUTO_CLAIM_SETTINGS_FILE = path.join(process.cwd(), "data", "auto_claim_settings.json");
// Default settings
const DEFAULT_AUTO_CLAIM_SETTINGS = {
    minRewards: 1.0,
    gasAware: 1.2,
    compoundAware: 1.5,
    timePeriod: 4,
    setAt: new Date().toISOString()
};
// Estimated gas units needed for claim operation
// Based on analysis of Balancer gauge contracts:
// - claim_rewards function typically uses ~90k-150k gas depending on the number of rewards
// - We use a conservative estimate to ensure we don't underestimate costs
const GAS_UNITS_PER_CLAIM = 150000;
const GAS_UNITS_PER_STAKE = 150000;
// Time-value optimization parameters
const WEEKLY_APY_ASSUMPTION = 0.05; // 5% weekly APY as baseline
const DAYS_PER_WEEK = 7;
/**
 * Load auto claim settings from file or return defaults
 */
function loadAutoClaimSettings() {
    try {
        const dataDir = path.dirname(AUTO_CLAIM_SETTINGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (fs.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
            const data = fs.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(data);
            // Validate settings - use defaults for any missing values
            return {
                minRewards: settings.minRewards ?? DEFAULT_AUTO_CLAIM_SETTINGS.minRewards,
                gasAware: settings.gasAware ?? DEFAULT_AUTO_CLAIM_SETTINGS.gasAware,
                compoundAware: settings.compoundAware ?? DEFAULT_AUTO_CLAIM_SETTINGS.compoundAware,
                timePeriod: settings.timePeriod ?? DEFAULT_AUTO_CLAIM_SETTINGS.timePeriod,
                setAt: settings.setAt ?? DEFAULT_AUTO_CLAIM_SETTINGS.setAt
            };
        }
        else {
            // Create default settings file if it doesn't exist
            fs.writeFileSync(AUTO_CLAIM_SETTINGS_FILE, JSON.stringify(DEFAULT_AUTO_CLAIM_SETTINGS, null, 2));
            return DEFAULT_AUTO_CLAIM_SETTINGS;
        }
    }
    catch (error) {
        console.error("Error loading auto claim settings:", error);
        return DEFAULT_AUTO_CLAIM_SETTINGS;
    }
}
/**
 * Save auto claim settings to file
 */
function saveAutoClaimSettings(settings) {
    try {
        const dataDir = path.dirname(AUTO_CLAIM_SETTINGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Merge with existing settings
        const currentSettings = loadAutoClaimSettings();
        const newSettings = {
            ...currentSettings,
            ...settings,
            setAt: new Date().toISOString()
        };
        fs.writeFileSync(AUTO_CLAIM_SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
        console.log("Auto claim settings saved successfully");
    }
    catch (error) {
        console.error("Error saving auto claim settings:", error);
    }
}
/**
 * Check if auto claim settings are still active based on time period
 */
function areAutoClaimSettingsActive(settings) {
    const setDate = new Date(settings.setAt);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate.getTime() - setDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Convert time period from weeks to days
    const timePeriodDays = settings.timePeriod * 7;
    return diffDays <= timePeriodDays;
}
/**
 * Main function to claim rewards from all gauges
 * @param walletAddress Optional wallet address to read/claim rewards for (overrides private key wallet)
 * @param useDelegation Boolean indicating whether to use delegation for executing transactions
 * @param delegationContractAddress Optional delegation contract address
 */
async function claimRewards(walletAddress, useDelegation = false, delegationContractAddress) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🤖 AUTO-COMPOUND AI: CLAIM REWARDS`);
    console.log(`${"=".repeat(60)}\n`);
    // When a wallet address is provided, log it
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
    // Load auto claim settings
    const autoClaimSettings = loadAutoClaimSettings();
    const isAutoClaimActive = areAutoClaimSettingsActive(autoClaimSettings);
    // Use provided parameters or active settings, or fall back to defaults
    const minRewardsThreshold = isAutoClaimActive ? autoClaimSettings.minRewards : MIN_REWARD_VALUE_USD;
    const gasAwareThreshold = isAutoClaimActive ? autoClaimSettings.gasAware : 1.2;
    const compoundAwareThreshold = isAutoClaimActive ? autoClaimSettings.compoundAware : 1.5;
    console.log("📊 USING CLAIM THRESHOLDS:");
    console.log(`   Minimum rewards: $${minRewardsThreshold.toFixed(4)} USD`);
    console.log(`   Gas awareness: ${gasAwareThreshold.toFixed(2)}x gas cost`);
    console.log(`   Compound awareness: ${compoundAwareThreshold.toFixed(2)}x gas cost`);
    if (isAutoClaimActive) {
        console.log(`   Auto claim settings are active (set ${Math.floor((new Date().getTime() - new Date(autoClaimSettings.setAt).getTime()) / (1000 * 60 * 60 * 24))} days ago, valid for ${autoClaimSettings.timePeriod} weeks)`);
    }
    else if (autoClaimSettings.setAt !== DEFAULT_AUTO_CLAIM_SETTINGS.setAt) {
        console.log(`   Auto claim settings have expired (set ${Math.floor((new Date().getTime() - new Date(autoClaimSettings.setAt).getTime()) / (1000 * 60 * 60 * 24))} days ago)`);
    }
    // Check current gas price
    let currentGasPriceGwei = 0;
    let estimatedGasCostPerOp = 0;
    const gasPrice = await provider.getFeeData();
    currentGasPriceGwei = parseFloat(ethers_1.ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"));
    // Calculate gas cost estimate based on current prices
    // Gas units × gas price (gwei) × 10^-9 × ETH price ($)
    const ethPriceUSD = 1800; // Approximate ETH price
    // Calculate total gas cost for claim + restake (multiply by 2)
    const totalGasUnits = GAS_UNITS_PER_CLAIM + GAS_UNITS_PER_STAKE;
    estimatedGasCostPerOp = totalGasUnits * currentGasPriceGwei * 1e-9 * ethPriceUSD;
    console.log(`\n⛽ Current gas price: ${currentGasPriceGwei.toFixed(2)} gwei`);
    console.log(`💰 Estimated cost for claim + restake: $${estimatedGasCostPerOp.toFixed(2)}`);
    console.log(`   • Claim: $${(GAS_UNITS_PER_CLAIM * currentGasPriceGwei * 1e-9 * ethPriceUSD).toFixed(2)}`);
    console.log(`   • Restake: $${(GAS_UNITS_PER_STAKE * currentGasPriceGwei * 1e-9 * ethPriceUSD).toFixed(2)}`);
    if (currentGasPriceGwei > MAX_GAS_PRICE_GWEI) {
        console.log(`❌ Gas price too high! Maximum allowed: ${MAX_GAS_PRICE_GWEI} gwei`);
        console.log("   Aborting claim operation to save on transaction costs.");
        return;
    }
    const claimLog = {
        timestamp: new Date().toISOString(),
        claims: [],
        summary: {
            totalClaimed: 0,
            totalGasCost: 0,
            netProfit: 0,
            errors: []
        }
    };
    try {
        // Read staking positions using readPositions function
        console.log("🔍 READING CURRENT POSITIONS AND REWARDS...");
        let positionData;
        let rewardsWorthClaiming = false;
        // Use readStakingPosition to get real positions and claimable rewards
        try {
            // Use the provided wallet address or get it from the wallet
            const userAddress = walletAddress || (wallet ? await wallet.getAddress() : undefined);
            if (userAddress) {
                positionData = await (0, readPositions_1.readStakingPosition)(userAddress);
                // When displaying rewards, add more detailed information
                if (positionData) {
                    console.log("\n🔄 REWARD TOKENS EXPLANATION:");
                    // Check if BAL rewards exist
                    if (positionData.rewards.BAL) {
                        console.log(`\n📊 BAL (${KNOWN_TOKENS.BAL.address}):`);
                        console.log(`   Amount: ${positionData.rewards.BAL.amount} BAL`);
                        console.log(`   Value: $${(parseFloat(positionData.rewards.BAL.amount) * KNOWN_TOKENS.BAL.price).toFixed(4)}`);
                        console.log(`   Current Price: $${KNOWN_TOKENS.BAL.price.toFixed(2)} per BAL`);
                        console.log(`   Description: ${KNOWN_TOKENS.BAL.description}`);
                        console.log(`   Usage: Can be held for governance voting, staked, or sold for other assets.`);
                    }
                    // Check if GHO rewards exist
                    if (positionData.rewards.GHO) {
                        console.log(`\n💰 GHO (${KNOWN_TOKENS.GHO.address}):`);
                        console.log(`   Amount: ${positionData.rewards.GHO.amount} GHO`);
                        console.log(`   Value: $${(parseFloat(positionData.rewards.GHO.amount) * KNOWN_TOKENS.GHO.price).toFixed(4)}`);
                        console.log(`   Current Price: $${KNOWN_TOKENS.GHO.price.toFixed(2)} per GHO`);
                        console.log(`   Description: ${KNOWN_TOKENS.GHO.description}`);
                        console.log(`   Usage: Can be used as a stablecoin for trading, lending, or directly as an LP asset.`);
                    }
                    // Restaking explanation
                    console.log(`\n♻️ RESTAKING EXPLANATION:`);
                    console.log(`   To restake in this pool (Aave GHO/USDT/USDC), you would need to:`);
                    console.log(`   1. Convert some rewards to GHO, USDT, and USDC in the right proportions`);
                    console.log(`   2. Add liquidity to the Balancer pool to receive LP tokens`);
                    console.log(`   3. Stake those LP tokens in the gauge again`);
                    console.log(`   Alternatively, you can use the rewards for other purposes in the DeFi ecosystem.`);
                }
                // Evaluate if rewards are worth claiming based on gas cost and time value
                console.log(`\n💰 TOTAL CLAIMABLE REWARDS: $${positionData.totalRewardsUSD.toFixed(2)}`);
                // Apply min reward threshold check
                if (positionData.totalRewardsUSD < minRewardsThreshold) {
                    console.log(`❌ Rewards too small to claim (less than $${minRewardsThreshold.toFixed(2)})`);
                    rewardsWorthClaiming = false;
                }
                // Apply gas aware threshold check (reward/gas ratio)
                else if ((positionData.totalRewardsUSD / estimatedGasCostPerOp) < gasAwareThreshold) {
                    console.log(`❌ Rewards/gas ratio (${(positionData.totalRewardsUSD / estimatedGasCostPerOp).toFixed(2)}) is less than threshold (${gasAwareThreshold.toFixed(2)})`);
                    console.log(`   Rewards: $${positionData.totalRewardsUSD.toFixed(2)}, Gas cost: $${estimatedGasCostPerOp.toFixed(2)}`);
                    console.log("   Skipping claim operation to avoid net loss.");
                    rewardsWorthClaiming = false;
                }
                // Apply compound aware threshold check (expected compound reward/gas ratio)
                else {
                    // Calculate expected compound gain
                    // This is a simplified estimate - in a real implementation, you would calculate expected APY
                    // from compounding this specific amount in specific pools
                    const expectedWeeklyYield = positionData.totalRewardsUSD * WEEKLY_APY_ASSUMPTION;
                    const expectedDailyYield = expectedWeeklyYield / 7;
                    const daysToBreakEven = estimatedGasCostPerOp / expectedDailyYield;
                    const compoundYieldRatio = expectedWeeklyYield / estimatedGasCostPerOp;
                    console.log(`📈 EXPECTED COMPOUND YIELD:`);
                    console.log(`   Weekly yield: $${expectedWeeklyYield.toFixed(4)} (${(WEEKLY_APY_ASSUMPTION * 100).toFixed(2)}% of $${positionData.totalRewardsUSD.toFixed(2)})`);
                    console.log(`   Daily yield: $${expectedDailyYield.toFixed(4)}`);
                    console.log(`   Days to break even on gas cost: ${daysToBreakEven.toFixed(1)}`);
                    console.log(`   Compound yield / gas ratio: ${compoundYieldRatio.toFixed(4)} (threshold: ${compoundAwareThreshold.toFixed(2)})`);
                    if (compoundYieldRatio < compoundAwareThreshold) {
                        console.log(`❌ Expected compound yield / gas ratio (${compoundYieldRatio.toFixed(4)}) is less than threshold (${compoundAwareThreshold.toFixed(2)})`);
                        console.log("   Skipping claim operation as compounding is not efficient enough.");
                        rewardsWorthClaiming = false;
                    }
                    else {
                        // All checks have passed
                        console.log(`✅ Reward checks passed: Amount: $${positionData.totalRewardsUSD.toFixed(2)}, Reward/gas: ${(positionData.totalRewardsUSD / estimatedGasCostPerOp).toFixed(2)}, Compound yield/gas: ${compoundYieldRatio.toFixed(4)}`);
                        console.log(`   Net profit (after gas): $${(positionData.totalRewardsUSD - estimatedGasCostPerOp).toFixed(2)}`);
                        console.log("   Proceeding with claim operation.");
                        rewardsWorthClaiming = true;
                    }
                }
                if (!rewardsWorthClaiming) {
                    return;
                }
            }
        }
        catch (error) {
            console.error("Error reading positions:", error);
            return;
        }
        if (!rewardsWorthClaiming) {
            console.log("❌ Skipping claim operation as rewards are not worth claiming.");
            return;
        }
        // Claim rewards from the pool with the current gauge
        console.log("\n🧮 CLAIMING REWARDS...");
        // Use the provided wallet address or get it from the wallet
        const userAddress = walletAddress || (wallet ? await wallet.getAddress() : undefined);
        if (!userAddress) {
            console.log("❌ No wallet address available for claiming.");
            return;
        }
        // If wallet not provided, we can't execute transactions
        if (!wallet) {
            console.warn("⚠️ Wallet private key not provided. Can only read data but cannot perform transactions.");
            console.warn("   To claim rewards, provide the PRIVATE_KEY in .env");
            return;
        }
        // For simplicity, we use the gauge address directly from readPositions.ts
        const GAUGE_ADDRESS = "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f"; // GHO/USDT/USDC gauge
        try {
            const gauge = new ethers_1.ethers.Contract(GAUGE_ADDRESS, GAUGE_ABI, wallet);
            // Verify user's balance in the gauge
            const balance = await gauge.balanceOf(userAddress);
            if (balance == 0n) {
                console.log(`   No balance found in gauge ${GAUGE_ADDRESS}`);
                return;
            }
            console.log(`   Found ${ethers_1.ethers.formatEther(balance)} LP tokens in gauge`);
            // Get all claimable rewards before claiming
            const gaugeRewards = [];
            // Check BAL rewards
            const balToken = new ethers_1.ethers.Contract(BAL_TOKEN, ERC20_ABI, provider);
            const balSymbol = await balToken.symbol();
            const balDecimals = await balToken.decimals();
            try {
                // Check reward count to handle all possible rewards
                const rewardCount = await gauge.reward_count();
                console.log(`   Gauge has ${rewardCount} reward tokens`);
                for (let i = 0; i < Number(rewardCount); i++) {
                    try {
                        const tokenAddress = await gauge.reward_tokens(i);
                        const token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, provider);
                        const symbol = await token.symbol();
                        const decimals = await token.decimals();
                        const claimableAmount = await gauge.claimable_reward(userAddress, tokenAddress);
                        if (claimableAmount > 0n) {
                            const formattedAmount = ethers_1.ethers.formatUnits(claimableAmount, decimals);
                            console.log(`   Claimable ${symbol}: ${formattedAmount}`);
                            gaugeRewards.push({
                                token: tokenAddress,
                                symbol,
                                decimals,
                                amount: claimableAmount
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`   Failed to check reward at index ${i}`);
                    }
                }
            }
            catch (error) {
                console.warn(`   Failed to check reward count, falling back to known tokens`);
                // Check for BAL rewards
                try {
                    const claimableBAL = await gauge.claimable_reward(userAddress, BAL_TOKEN);
                    if (claimableBAL > 0n) {
                        const formattedAmount = ethers_1.ethers.formatUnits(claimableBAL, balDecimals);
                        console.log(`   Claimable ${balSymbol}: ${formattedAmount}`);
                        gaugeRewards.push({
                            token: BAL_TOKEN,
                            symbol: balSymbol,
                            decimals: balDecimals,
                            amount: claimableBAL
                        });
                    }
                }
                catch (error) {
                    console.warn(`   Failed to check BAL rewards: ${error.message}`);
                }
                // Try to check for GHO rewards or other common rewards
                const knownTokens = [
                    "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", // GHO
                ];
                for (const tokenAddress of knownTokens) {
                    try {
                        const token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, provider);
                        const symbol = await token.symbol();
                        const decimals = await token.decimals();
                        const claimable = await gauge.claimable_reward(userAddress, tokenAddress);
                        if (claimable > 0n) {
                            const formattedAmount = ethers_1.ethers.formatUnits(claimable, decimals);
                            console.log(`   Claimable ${symbol}: ${formattedAmount}`);
                            gaugeRewards.push({
                                token: tokenAddress,
                                symbol,
                                decimals,
                                amount: claimable
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`   Failed to check rewards for token ${tokenAddress}`);
                    }
                }
            }
            // Skip if no rewards to claim
            if (gaugeRewards.length === 0) {
                console.log(`   No rewards to claim from gauge`);
                return;
            }
            // Claim all rewards
            console.log(`   Claiming rewards from gauge...`);
            const tx = await gauge.claim_rewards(userAddress);
            console.log(`   Transaction submitted: ${tx.hash}`);
            console.log("   Waiting for transaction confirmation...");
            await tx.wait();
            console.log("   Transaction confirmed!");
            // Log the claimed rewards
            for (const reward of gaugeRewards) {
                const valueUSD = positionData?.rewards[reward.symbol]?.valueUSD || 0;
                console.log(`     Claimed ${ethers_1.ethers.formatUnits(reward.amount, reward.decimals)} ${reward.symbol} ($${valueUSD.toFixed(2)})`);
            }
            // Update claim log
            claimLog.claims.push({
                gaugeAddress: GAUGE_ADDRESS,
                rewards: gaugeRewards.map(reward => ({
                    token: reward.token,
                    symbol: reward.symbol,
                    amount: reward.amount.toString(),
                    valueUSD: positionData?.rewards[reward.symbol]?.valueUSD || 0
                }))
            });
            // Calculate total claimed value
            const totalClaimedUSD = positionData?.totalRewardsUSD || 0;
            const netProfit = totalClaimedUSD - estimatedGasCostPerOp;
            claimLog.summary.totalClaimed = totalClaimedUSD;
            claimLog.summary.totalGasCost = estimatedGasCostPerOp;
            claimLog.summary.netProfit = netProfit;
            console.log(`\n✅ CLAIM OPERATION COMPLETED SUCCESSFULLY`);
            console.log(`   Total USD value claimed: $${totalClaimedUSD.toFixed(2)}`);
            console.log(`   Estimated gas cost (claim + restake): $${estimatedGasCostPerOp.toFixed(2)}`);
            console.log(`   Net profit: $${netProfit.toFixed(2)}`);
        }
        catch (error) {
            console.error(`❌ ERROR DURING CLAIM OPERATION: ${error}`);
            claimLog.summary.errors.push(String(error));
        }
    }
    catch (error) {
        console.error("❌ ERROR DURING EXECUTION:", error);
        claimLog.summary.errors.push(String(error));
    }
    // Save claim log
    saveClaimLog(claimLog);
    console.log(`\n📝 Claim log saved to ${CLAIM_LOG_FILE}`);
}
/**
 * Save claim log to file
 */
function saveClaimLog(log) {
    try {
        // Ensure directory exists
        const dir = path.dirname(CLAIM_LOG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CLAIM_LOG_FILE, JSON.stringify(log, null, 2));
    }
    catch (error) {
        console.error(`Failed to save claim log: ${error}`);
    }
}
/**
 * Calculate USD value for a token (simplified for demo purposes)
 */
function calculateUSDValue(tokenAddress, amount, decimals) {
    // In a real implementation, we would use an oracle or price feed
    // For this demo, we're using a simplified approach with hard-coded prices
    let tokenPriceUSD = 0;
    switch (tokenAddress.toLowerCase()) {
        case BAL_TOKEN.toLowerCase():
            tokenPriceUSD = 5.3; // $5.30 per BAL
            break;
        case WETH_TOKEN.toLowerCase():
            tokenPriceUSD = 1800; // $1,800 per ETH
            break;
        default:
            tokenPriceUSD = 1; // Default to $1 for unknown tokens
    }
    return Number(ethers_1.ethers.formatUnits(amount, decimals)) * tokenPriceUSD;
}
/**
 * Claim rewards from specific gauges
 */
async function claimRewardsFromGauges(gaugeAddresses, walletAddress, useDelegation = false, delegationContractAddress) {
    try {
        console.log(`Claiming rewards from ${gaugeAddresses.length} gauges`);
        // Check if we should use delegation
        if (useDelegation && delegationContractAddress) {
            console.log(`Using delegation contract at ${delegationContractAddress}`);
            // Import delegation functions
            const { executeClaimWithDelegation } = require('./delegatedClaiming');
            if (!walletAddress) {
                throw new Error("Wallet address is required when using delegation");
            }
            // Get reward tokens for each gauge
            const rewardTokensPerGauge = [];
            // For each gauge, identify all reward tokens (simplified implementation)
            for (const gauge of gaugeAddresses) {
                // For this simplified version, we'll use common reward tokens
                // In a full implementation, you'd query each gauge for its specific reward tokens
                rewardTokensPerGauge.push([
                    "0xba100000625a3754423978a60c9317c58a424e3D", // BAL
                    "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f" // GHO
                ]);
            }
            // Execute the claim through delegation
            const txHash = await executeClaimWithDelegation(walletAddress, gaugeAddresses, rewardTokensPerGauge, delegationContractAddress);
            // Return a standard response
            return {
                transactionHash: txHash,
                blockNumber: 0 // Not available when using delegation
            };
        }
        // If not using delegation, use the direct approach with private key
        // Create provider and wallet
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
        let userWallet;
        // If a wallet address is provided but no private key, we can't perform the claim
        if (walletAddress && !process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY environment variable is required for claiming rewards");
        }
        // Always use the PRIVATE_KEY for signing transactions
        if (!process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY environment variable is required for claiming rewards");
        }
        userWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider);
        // Verify that the wallet address matches the expected one
        if (walletAddress && (await userWallet.getAddress()).toLowerCase() !== walletAddress.toLowerCase()) {
            console.warn(`Warning: Provided wallet address ${walletAddress} doesn't match the address from PRIVATE_KEY`);
            // Continue anyway, using the private key wallet for signing but claiming to the provided address
        }
        // ABI for claim method
        const gaugeABI = [
            'function claim_rewards(address user)',
            'function claim_rewards()'
        ];
        // Claim from each gauge
        const results = [];
        for (const gaugeAddress of gaugeAddresses) {
            try {
                console.log(`Claiming rewards from gauge ${gaugeAddress}`);
                const gaugeContract = new ethers_1.ethers.Contract(gaugeAddress, gaugeABI, userWallet);
                // Some gauges require the user address, some don't
                let tx;
                try {
                    // If walletAddress is provided, claim for that specific address
                    // Otherwise claim for the wallet's own address
                    const claimForAddress = walletAddress || await userWallet.getAddress();
                    tx = await gaugeContract.claim_rewards(claimForAddress);
                }
                catch (error) {
                    // If the first method fails, try the one without parameters
                    console.log(`Fallback to no-parameter claim method for gauge ${gaugeAddress}`);
                    tx = await gaugeContract.claim_rewards();
                }
                console.log(`Transaction sent: ${tx.hash}`);
                // Wait for transaction to be mined
                const receipt = await tx.wait();
                console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
                results.push({
                    gauge: gaugeAddress,
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    status: receipt.status
                });
            }
            catch (error) {
                console.error(`Error claiming from gauge ${gaugeAddress}:`, error);
                throw error;
            }
        }
        // Return the hash of the last transaction as a success indicator
        return {
            transactionHash: results[results.length - 1].transactionHash,
            blockNumber: results[results.length - 1].blockNumber
        };
    }
    catch (error) {
        console.error('Error claiming rewards:', error);
        throw error;
    }
}
// If this file is run directly, execute the agent
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
    claimRewards(walletAddress, useDelegation, delegationContractAddress)
        .then(() => {
        console.log("\nClaim operation completed.");
        process.exit(0);
    })
        .catch(error => {
        console.error("\nClaim operation failed:", error);
        process.exit(1);
    });
}
exports.default = claimRewards;
//# sourceMappingURL=claimRewards.js.map