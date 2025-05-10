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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRewardsThresholds = checkRewardsThresholds;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
const readPositions_1 = require("./readPositions");
const claimRewards_1 = require("./claimRewards");
const balancerUtils_1 = require("../utils/balancerUtils");
const delegatedClaiming_1 = require("./delegatedClaiming");
const axios_1 = __importDefault(require("axios"));
dotenv.config();
// Path to the auto claim settings file
const AUTO_CLAIM_SETTINGS_FILE = path_1.default.join(process.cwd(), "data", "auto_claim_settings.json");
// Path to the last check log
const LAST_CHECK_LOG_FILE = path_1.default.join(process.cwd(), "data", "auto_claim_check_logs", `last_check.json`);
// Default settings
const DEFAULT_AUTO_CLAIM_SETTINGS = {
    minRewards: 1.0,
    gasAware: 1.2,
    compoundAware: 1.5,
    timePeriod: 4,
    setAt: new Date().toISOString()
};
// Ensure directory exists
function ensureDirectoryExists(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
}
// Load auto claim settings from file
function loadAutoClaimSettings() {
    try {
        if (fs_1.default.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
            const data = fs_1.default.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(data);
            // Validate settings - use defaults for any missing values
            return {
                minRewards: settings.minRewards ?? DEFAULT_AUTO_CLAIM_SETTINGS.minRewards,
                gasAware: settings.gasAware ?? DEFAULT_AUTO_CLAIM_SETTINGS.gasAware,
                compoundAware: settings.compoundAware ?? DEFAULT_AUTO_CLAIM_SETTINGS.compoundAware,
                timePeriod: settings.timePeriod ?? DEFAULT_AUTO_CLAIM_SETTINGS.timePeriod,
                setAt: settings.setAt ?? DEFAULT_AUTO_CLAIM_SETTINGS.setAt,
                walletAddress: settings.walletAddress,
                useDelegation: settings.useDelegation,
                delegationContractAddress: settings.delegationContractAddress
            };
        }
        else {
            // Create default settings file if it doesn't exist
            ensureDirectoryExists(path_1.default.dirname(AUTO_CLAIM_SETTINGS_FILE));
            fs_1.default.writeFileSync(AUTO_CLAIM_SETTINGS_FILE, JSON.stringify(DEFAULT_AUTO_CLAIM_SETTINGS, null, 2));
            return DEFAULT_AUTO_CLAIM_SETTINGS;
        }
    }
    catch (error) {
        console.error("Error loading auto claim settings:", error);
        return DEFAULT_AUTO_CLAIM_SETTINGS;
    }
}
// Check if auto claim settings are still active
function areAutoClaimSettingsActive(settings) {
    const setDate = new Date(settings.setAt);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate.getTime() - setDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Convert time period from weeks to days
    const timePeriodDays = settings.timePeriod * 7;
    return diffDays <= timePeriodDays;
}
// Save the check log
function saveCheckLog(log) {
    try {
        const dirPath = path_1.default.dirname(LAST_CHECK_LOG_FILE);
        ensureDirectoryExists(dirPath);
        // Also save a timestamped copy
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const timestampedLogFile = path_1.default.join(dirPath, `check_${timestamp}.json`);
        fs_1.default.writeFileSync(LAST_CHECK_LOG_FILE, JSON.stringify(log, null, 2));
        fs_1.default.writeFileSync(timestampedLogFile, JSON.stringify(log, null, 2));
    }
    catch (error) {
        console.error(`Failed to save check log: ${error}`);
    }
}
// Calculate gas costs for claim and restake operations
async function calculateGasCosts() {
    // Initialize provider from environment variable
    const rpcUrl = process.env.ETHEREUM_RPC;
    const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
    // Constants for gas estimation
    const GAS_UNITS_PER_CLAIM = 150000;
    const GAS_UNITS_PER_STAKE = 150000;
    // Fetch current ETH price from CoinGecko API
    let ETH_PRICE_USD = 1800; // Default fallback price
    try {
        const response = await axios_1.default.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (response.data && response.data.ethereum && response.data.ethereum.usd) {
            ETH_PRICE_USD = response.data.ethereum.usd;
            console.log(`Fetched ETH price: $${ETH_PRICE_USD}`);
        }
        else {
            console.warn('Failed to parse ETH price from API response, using fallback price');
        }
    }
    catch (error) {
        console.warn('Failed to fetch ETH price from CoinGecko API, using fallback price:', error);
    }
    // Get current gas price
    const gasPrice = await provider.getFeeData();
    const currentGasPriceGwei = parseFloat(ethers_1.ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"));
    // Calculate gas costs
    const claimGasCost = GAS_UNITS_PER_CLAIM * currentGasPriceGwei * 1e-9 * ETH_PRICE_USD;
    const stakeGasCost = GAS_UNITS_PER_STAKE * currentGasPriceGwei * 1e-9 * ETH_PRICE_USD;
    const totalGasCost = claimGasCost + stakeGasCost;
    return {
        gasPriceGwei: currentGasPriceGwei,
        ethPriceUsd: ETH_PRICE_USD,
        claimGasCost,
        stakeGasCost,
        totalGasCost
    };
}
// Weekly APY for compound calculations
const WEEKLY_APY_ASSUMPTION = 0.05; // 5% weekly APY
// Default configuration
const DEFAULT_CONFIG = {
    minUsdValue: 10, // $10 minimum by default
    gasAwareThreshold: 1.2, // Default gas aware threshold
    compoundAwareThreshold: 1.5, // Default compound aware threshold
    outputDir: path_1.default.join(process.cwd(), 'data', 'auto_claim_logs'),
    useDelegation: false
};
// Parse command line arguments to get configuration
function parseArgs() {
    const config = { ...DEFAULT_CONFIG };
    const args = process.argv.slice(2);
    args.forEach(arg => {
        if (arg.startsWith('--min-value=')) {
            const value = parseFloat(arg.split('=')[1]);
            if (!isNaN(value)) {
                config.minUsdValue = value;
            }
        }
        else if (arg.startsWith('--gas-aware=')) {
            const value = parseFloat(arg.split('=')[1]);
            if (!isNaN(value)) {
                config.gasAwareThreshold = value;
            }
        }
        else if (arg.startsWith('--compound-aware=')) {
            const value = parseFloat(arg.split('=')[1]);
            if (!isNaN(value)) {
                config.compoundAwareThreshold = value;
            }
        }
        else if (arg.startsWith('--address=')) {
            config.address = arg.split('=')[1];
        }
        else if (arg === '--address' && args.indexOf(arg) < args.length - 1) {
            // Handle --address followed by the address as separate argument
            config.address = args[args.indexOf(arg) + 1];
        }
        else if (arg.startsWith('--output-dir=')) {
            config.outputDir = arg.split('=')[1];
        }
        else if (arg === '--use-delegation' || arg === '--delegation') {
            config.useDelegation = true;
        }
        else if (arg.startsWith('--delegation-contract=')) {
            config.delegationContractAddress = arg.split('=')[1];
            // Automatically enable delegation if contract address is specified
            config.useDelegation = true;
        }
    });
    // Load thresholds from auto claim settings
    try {
        if (fs_1.default.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
            const data = fs_1.default.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(data);
            if (settings) {
                if (settings.minRewards !== undefined) {
                    console.log(`Loading min rewards from auto_claim_settings.json: ${settings.minRewards}`);
                    config.minUsdValue = settings.minRewards;
                }
                if (settings.gasAware !== undefined) {
                    console.log(`Loading gas aware threshold from auto_claim_settings.json: ${settings.gasAware}`);
                    config.gasAwareThreshold = settings.gasAware;
                }
                if (settings.compoundAware !== undefined) {
                    console.log(`Loading compound aware threshold from auto_claim_settings.json: ${settings.compoundAware}`);
                    config.compoundAwareThreshold = settings.compoundAware;
                }
                // Read wallet address from settings if not provided in command line
                if (!config.address && settings.walletAddress) {
                    console.log(`Loading wallet address from auto_claim_settings.json: ${settings.walletAddress}`);
                    config.address = settings.walletAddress;
                }
                // Read delegation settings
                if (settings.useDelegation !== undefined) {
                    console.log(`Loading delegation setting from auto_claim_settings.json: ${settings.useDelegation}`);
                    config.useDelegation = settings.useDelegation;
                }
                if (settings.delegationContractAddress) {
                    console.log(`Loading delegation contract from auto_claim_settings.json: ${settings.delegationContractAddress}`);
                    config.delegationContractAddress = settings.delegationContractAddress;
                }
            }
        }
    }
    catch (error) {
        console.error("Error loading thresholds from auto claim settings:", error);
    }
    return config;
}
// Main function to check reward thresholds and trigger claiming if needed
async function checkRewardsThresholds() {
    // Parse configuration
    const config = parseArgs();
    // Ensure output directory exists
    ensureOutputDirExists(config.outputDir);
    // Create a log file with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const logFile = path_1.default.join(config.outputDir, `check_${timestamp}.log`);
    // Initialize the log file
    fs_1.default.writeFileSync(logFile, `Auto Claim Check - ${new Date().toISOString()}\n`);
    fs_1.default.appendFileSync(logFile, '----------------------------------------\n');
    // Log configuration
    log(`Configuration:`, logFile);
    log(`- Minimum USD threshold: $${config.minUsdValue}`, logFile);
    log(`- Gas aware threshold: ${config.gasAwareThreshold}x gas cost`, logFile);
    log(`- Compound aware threshold: ${config.compoundAwareThreshold}x gas cost`, logFile);
    if (config.address) {
        log(`- Checking address: ${config.address}`, logFile);
    }
    else {
        log(`- Error: No wallet address specified`, logFile);
        return false;
    }
    log('----------------------------------------', logFile);
    // Calculate gas costs for claiming and restaking
    const gasCosts = await calculateGasCosts();
    log(`Current gas price: ${gasCosts.gasPriceGwei.toFixed(2)} gwei`, logFile);
    log(`Estimated cost for claim + restake: $${gasCosts.totalGasCost.toFixed(4)}`, logFile);
    try {
        // Get the address to check
        let userAddress;
        if (config.address) {
            userAddress = config.address;
            log(`Using provided wallet address: ${userAddress}`, logFile);
        }
        else {
            const errorMsg = 'User address not specified';
            log(`Error checking rewards: ${errorMsg}`, logFile);
            throw new Error(errorMsg);
        }
        log(`Checking rewards for address: ${userAddress}`, logFile);
        // Use readStakingPosition to get position data - this is more reliable than getPositionsForAddress
        log('Fetching current positions using readStakingPosition...', logFile);
        let positionData;
        try {
            positionData = await (0, readPositions_1.readStakingPosition)(userAddress);
            // Check if we have any staked positions
            const hasStakedPosition = positionData.staked && parseFloat(positionData.staked.balance) > 0;
            const hasRewards = positionData.totalRewardsUSD > 0;
            if (!hasStakedPosition && !hasRewards) {
                log('No positions or rewards found for this address.', logFile);
                return false;
            }
            // Log the rewards
            if (hasRewards) {
                log(`Found claimable rewards with total value: $${positionData.totalRewardsUSD.toFixed(2)}`, logFile);
                log('Reward tokens:', logFile);
                for (const [token, data] of Object.entries(positionData.rewards)) {
                    log(`  ${token}: ${data.amount} ($${data.valueUSD.toFixed(2)})`, logFile);
                }
            }
            // Check if we've reached the threshold - now applying all three checks
            if (positionData.totalRewardsUSD < config.minUsdValue) {
                log(`Threshold not reached. ($${positionData.totalRewardsUSD.toFixed(3)} < $${config.minUsdValue})`, logFile);
                return false;
            }
            // Gas aware check
            const rewardGasRatio = positionData.totalRewardsUSD / gasCosts.totalGasCost;
            if (rewardGasRatio < config.gasAwareThreshold) {
                log(`Gas aware check failed. Reward/gas ratio ${rewardGasRatio.toFixed(2)} < ${config.gasAwareThreshold}`, logFile);
                return false;
            }
            // Compound aware check - calculate expected yield from compounding
            const expectedWeeklyYield = positionData.totalRewardsUSD * WEEKLY_APY_ASSUMPTION;
            const expectedDailyYield = expectedWeeklyYield / 7;
            const daysToBreakEven = gasCosts.totalGasCost / expectedDailyYield;
            const compoundYieldRatio = expectedWeeklyYield / gasCosts.totalGasCost;
            log(`Expected weekly compound yield: $${expectedWeeklyYield.toFixed(4)} (${(WEEKLY_APY_ASSUMPTION * 100).toFixed(2)}%)`, logFile);
            log(`Expected daily compound yield: $${expectedDailyYield.toFixed(4)}`, logFile);
            log(`Days to break even on gas cost: ${daysToBreakEven.toFixed(1)}`, logFile);
            log(`Compound yield / gas ratio: ${compoundYieldRatio.toFixed(2)}`, logFile);
            if (compoundYieldRatio < config.compoundAwareThreshold) {
                log(`Compound aware check failed. Yield/gas ratio ${compoundYieldRatio.toFixed(2)} < ${config.compoundAwareThreshold}`, logFile);
                return false;
            }
            log(`🔔 All threshold checks passed! Initiating claim process...`, logFile);
            // Get gauges from common gauges
            const gaugeAddresses = readPositions_1.COMMON_GAUGES.map((g) => g.gauge);
            // If using delegation, verify with the smart contract and use delegated claiming
            if (config.useDelegation && config.delegationContractAddress) {
                try {
                    log(`Checking delegation status with contract at ${config.delegationContractAddress}`, logFile);
                    // Get reward tokens for each gauge
                    const rewardTokensPerGauge = [];
                    // For each gauge, identify all reward tokens
                    for (const gauge of readPositions_1.COMMON_GAUGES) {
                        // Find this gauge in our gauges data
                        const gaugeData = await (0, balancerUtils_1.getGauges)().then(gauges => gauges.find(g => g.address.toLowerCase() === gauge.gauge.toLowerCase()));
                        if (gaugeData && gaugeData.rewardTokens) {
                            // Extract token addresses
                            const tokenAddresses = gaugeData.rewardTokens.map(t => t.tokenAddress);
                            rewardTokensPerGauge.push(tokenAddresses);
                        }
                        else {
                            // If we can't find reward tokens, use an empty array
                            rewardTokensPerGauge.push([]);
                        }
                    }
                    // Check if we should claim via the delegation contract
                    const shouldClaim = await (0, delegatedClaiming_1.shouldClaimForUser)(userAddress, positionData.totalRewardsUSD, config.delegationContractAddress);
                    if (shouldClaim) {
                        log(`Delegation contract confirms claiming should proceed`, logFile);
                        // Execute the claim with delegation
                        try {
                            log(`Executing delegated claim for user ${userAddress}`, logFile);
                            const transactionHash = await (0, delegatedClaiming_1.executeClaimWithDelegation)(userAddress, gaugeAddresses, rewardTokensPerGauge, config.delegationContractAddress);
                            log(`Delegated claim successful! Transaction hash: ${transactionHash}`, logFile);
                            // Save the result
                            const resultFile = path_1.default.join(config.outputDir, `claim_result_${timestamp}.json`);
                            fs_1.default.writeFileSync(resultFile, JSON.stringify({
                                timestamp: new Date().toISOString(),
                                address: userAddress,
                                gauges: gaugeAddresses,
                                transactionHash,
                                delegated: true,
                                success: true
                            }, null, 2));
                            return true;
                        }
                        catch (error) {
                            log(`Error executing delegated claim: ${error.message || String(error)}`, logFile);
                            // Save the error
                            const errorFile = path_1.default.join(config.outputDir, `claim_error_${timestamp}.json`);
                            fs_1.default.writeFileSync(errorFile, JSON.stringify({
                                timestamp: new Date().toISOString(),
                                address: userAddress,
                                gauges: gaugeAddresses,
                                delegated: true,
                                success: false,
                                error: error.message || String(error)
                            }, null, 2));
                            return false;
                        }
                    }
                    else {
                        log(`Delegation contract indicates claiming should not proceed at this time`, logFile);
                        return false;
                    }
                }
                catch (error) {
                    log(`Error using delegation: ${error.message || String(error)}`, logFile);
                    log('Falling back to direct claiming method...', logFile);
                    // Continue with normal claim process as fallback
                }
            }
            // Save the claim request
            const claimRequest = {
                timestamp: new Date().toISOString(),
                address: userAddress,
                gauges: gaugeAddresses,
                rewardsValue: positionData.totalRewardsUSD
            };
            const requestFile = path_1.default.join(config.outputDir, `claim_request_${timestamp}.json`);
            fs_1.default.writeFileSync(requestFile, JSON.stringify(claimRequest, null, 2));
            // Execute the claim (always in live mode)
            log('Claiming rewards now...', logFile);
            try {
                let result;
                // When using delegation, pass the delegation parameters
                if (config.useDelegation && config.delegationContractAddress) {
                    result = await (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress, true, config.delegationContractAddress);
                    log('Delegated claim successful!', logFile);
                    log(`Transaction hash: ${result.transactionHash}`, logFile);
                }
                else {
                    // Traditional claim method - still pass the wallet address
                    result = await (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress);
                    log('Claim successful!', logFile);
                    log(`Transaction hash: ${result.transactionHash}`, logFile);
                }
                // Save the result
                const resultFile = path_1.default.join(config.outputDir, `claim_result_${timestamp}.json`);
                fs_1.default.writeFileSync(resultFile, JSON.stringify({
                    ...claimRequest,
                    success: true,
                    transactionHash: result.transactionHash,
                    blockNumber: result.blockNumber
                }, null, 2));
            }
            catch (error) {
                log(`Error claiming rewards: ${error.message || String(error)}`, logFile);
                // Save the error
                const errorFile = path_1.default.join(config.outputDir, `claim_error_${timestamp}.json`);
                fs_1.default.writeFileSync(errorFile, JSON.stringify({
                    ...claimRequest,
                    success: false,
                    error: error.message || String(error)
                }, null, 2));
                return false;
            }
            return true;
        }
        catch (error) {
            log(`Error fetching positions with readStakingPosition: ${error}`, logFile);
            log('Falling back to getPositionsForAddress method...', logFile);
            // Fall back to original method
            let positions = [];
            try {
                positions = await (0, readPositions_1.getPositionsForAddress)(userAddress);
            }
            catch (error) {
                log(`Error fetching positions: ${error}`, logFile);
                log('Continuing with empty positions list', logFile);
                positions = [];
            }
            if (!positions || positions.length === 0) {
                log('No positions found for this address.', logFile);
                return false;
            }
            // Rest of the original implementation...
            // Log the positions
            log(`Found ${positions.length} positions:`, logFile);
            positions.forEach((pos, i) => {
                log(`  ${i + 1}. ${pos.symbol} (${pos.gauge})`, logFile);
            });
            // Get all the gauge addresses from positions
            const gaugeAddresses = positions.map((pos) => pos.gauge);
            // Get claimable rewards for these gauges
            log('Checking claimable rewards...', logFile);
            const { rewards, totalUsdValue } = await getClaimableRewards(userAddress, gaugeAddresses);
            // Log the rewards
            log('Claimable rewards:', logFile);
            Object.entries(rewards).forEach(([gauge, tokens]) => {
                log(`  Gauge ${gauge}:`, logFile);
                if (tokens) {
                    Object.entries(tokens).forEach(([token, data]) => {
                        if (data) {
                            log(`    ${token}: ${data.amount} (${data.symbol}) = $${data.usdValue.toFixed(2)}`, logFile);
                        }
                    });
                }
            });
            log(`Total claimable rewards value: $${totalUsdValue.toFixed(2)}`, logFile);
            // Check if we've reached the threshold - now applying all three checks
            if (totalUsdValue < config.minUsdValue) {
                log(`Threshold not reached. ($${totalUsdValue.toFixed(3)} < $${config.minUsdValue})`, logFile);
                return false;
            }
            // Gas aware check
            const rewardGasRatio = totalUsdValue / gasCosts.totalGasCost;
            if (rewardGasRatio < config.gasAwareThreshold) {
                log(`Gas aware check failed. Reward/gas ratio ${rewardGasRatio.toFixed(2)} < ${config.gasAwareThreshold}`, logFile);
                return false;
            }
            // Compound aware check - calculate expected yield from compounding
            const expectedWeeklyYield = totalUsdValue * WEEKLY_APY_ASSUMPTION;
            const expectedDailyYield = expectedWeeklyYield / 7;
            const daysToBreakEven = gasCosts.totalGasCost / expectedDailyYield;
            const compoundYieldRatio = expectedWeeklyYield / gasCosts.totalGasCost;
            log(`Expected weekly compound yield: $${expectedWeeklyYield.toFixed(4)} (${(WEEKLY_APY_ASSUMPTION * 100).toFixed(2)}%)`, logFile);
            log(`Expected daily compound yield: $${expectedDailyYield.toFixed(4)}`, logFile);
            log(`Days to break even on gas cost: ${daysToBreakEven.toFixed(1)}`, logFile);
            log(`Compound yield / gas ratio: ${compoundYieldRatio.toFixed(2)}`, logFile);
            if (compoundYieldRatio < config.compoundAwareThreshold) {
                log(`Compound aware check failed. Yield/gas ratio ${compoundYieldRatio.toFixed(2)} < ${config.compoundAwareThreshold}`, logFile);
                return false;
            }
            log(`🔔 All threshold checks passed! Initiating claim process...`, logFile);
            // Save the claim request
            const claimRequest = {
                timestamp: new Date().toISOString(),
                address: userAddress,
                gauges: gaugeAddresses,
                rewardsValue: totalUsdValue
            };
            const requestFile = path_1.default.join(config.outputDir, `claim_request_${timestamp}.json`);
            fs_1.default.writeFileSync(requestFile, JSON.stringify(claimRequest, null, 2));
            // Execute the claim (always in live mode)
            log('Claiming rewards now...', logFile);
            try {
                let result;
                // When using delegation, pass the delegation parameters
                if (config.useDelegation && config.delegationContractAddress) {
                    result = await (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress, true, config.delegationContractAddress);
                    log('Delegated claim successful!', logFile);
                    log(`Transaction hash: ${result.transactionHash}`, logFile);
                }
                else {
                    // Traditional claim method - still pass the wallet address
                    result = await (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress);
                    log('Claim successful!', logFile);
                    log(`Transaction hash: ${result.transactionHash}`, logFile);
                }
                // Save the result
                const resultFile = path_1.default.join(config.outputDir, `claim_result_${timestamp}.json`);
                fs_1.default.writeFileSync(resultFile, JSON.stringify({
                    ...claimRequest,
                    success: true,
                    transactionHash: result.transactionHash,
                    blockNumber: result.blockNumber
                }, null, 2));
            }
            catch (error) {
                log(`Error claiming rewards: ${error.message || String(error)}`, logFile);
                // Save the error
                const errorFile = path_1.default.join(config.outputDir, `claim_error_${timestamp}.json`);
                fs_1.default.writeFileSync(errorFile, JSON.stringify({
                    ...claimRequest,
                    success: false,
                    error: error.message || String(error)
                }, null, 2));
                return false;
            }
            return true;
        }
    }
    catch (error) {
        log(`Error checking rewards: ${error.message || String(error)}`, logFile);
        return false;
    }
}
// Function to get claimable rewards for an address from specified gauges
async function getClaimableRewards(address, gaugeAddresses) {
    try {
        // Create provider
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
        // Get gauge interface (ABI)
        const gaugeABI = [
            'function claimable_reward(address user, address token) external view returns (uint256)',
            'function reward_tokens(uint256 index) external view returns (address)'
        ];
        // Get all available gauges data
        const allGauges = await (0, balancerUtils_1.getGauges)();
        // Prepare the result object
        const rewards = {};
        let totalUsdValue = 0;
        // Check each gauge
        for (const gaugeAddress of gaugeAddresses) {
            try {
                const gauge = new ethers_1.ethers.Contract(gaugeAddress, gaugeABI, provider);
                rewards[gaugeAddress] = {};
                // Find this gauge in our gauges data
                const gaugeData = allGauges.find(g => g.address.toLowerCase() === gaugeAddress.toLowerCase());
                if (!gaugeData) {
                    console.warn(`Gauge ${gaugeAddress} not found in gauge data`);
                    continue;
                }
                // Check rewards for each token
                if (gaugeData.rewardTokens && gaugeData.rewardTokens.length > 0) {
                    for (const tokenInfo of gaugeData.rewardTokens) {
                        try {
                            const tokenAddress = tokenInfo.tokenAddress;
                            const claimable = await gauge.claimable_reward(address, tokenAddress);
                            if (claimable > 0n) {
                                const formattedAmount = ethers_1.ethers.formatUnits(claimable, tokenInfo.decimals);
                                const usdValue = parseFloat(formattedAmount) * (tokenInfo.price || 0);
                                rewards[gaugeAddress][tokenAddress] = {
                                    amount: formattedAmount,
                                    symbol: tokenInfo.symbol,
                                    usdValue
                                };
                                totalUsdValue += usdValue;
                            }
                        }
                        catch (error) {
                            console.warn(`Error checking reward token ${tokenInfo.symbol} in gauge ${gaugeAddress}: ${error}`);
                            // Continue with next token, don't let one token fail the whole process
                        }
                    }
                }
                else {
                    // If we don't have reward token info, try to query it directly
                    try {
                        // Try to get reward tokens dynamically
                        let index = 0;
                        const rewardTokens = [];
                        while (true) {
                            try {
                                const token = await gauge.reward_tokens(index);
                                rewardTokens.push(token);
                                index++;
                                // Safety check to avoid infinite loops
                                if (index > 20) {
                                    console.warn(`Too many reward tokens for gauge ${gaugeAddress}, stopping at 20`);
                                    break;
                                }
                            }
                            catch (e) {
                                // We've reached the end of the reward tokens list
                                break;
                            }
                        }
                        // For each reward token, get the claimable amount
                        for (const tokenAddress of rewardTokens) {
                            try {
                                const claimable = await gauge.claimable_reward(address, tokenAddress);
                                if (claimable > 0n) {
                                    // We don't have price info for this token, so just log the raw amount
                                    rewards[gaugeAddress][tokenAddress] = {
                                        amount: ethers_1.ethers.formatEther(claimable), // Assume 18 decimals
                                        symbol: 'UNKNOWN',
                                        usdValue: 0
                                    };
                                }
                            }
                            catch (error) {
                                console.warn(`Error checking reward for token ${tokenAddress} in gauge ${gaugeAddress}: ${error}`);
                                // Continue with next token
                            }
                        }
                    }
                    catch (error) {
                        console.warn(`Error querying reward tokens for gauge ${gaugeAddress}: ${error}`);
                        // Continue with next gauge
                    }
                }
            }
            catch (error) {
                console.warn(`Error processing gauge ${gaugeAddress}: ${error}`);
                // Continue with next gauge, don't fail the entire function
            }
        }
        return { rewards, totalUsdValue };
    }
    catch (error) {
        console.error('Error getting claimable rewards:', error);
        // Return empty results on error rather than failing
        return { rewards: {}, totalUsdValue: 0 };
    }
}
// Function to ensure the output directory exists
function ensureOutputDirExists(outputDir) {
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
}
// Function to log to both console and file
function log(message, outputFile) {
    console.log(message);
    if (outputFile) {
        fs_1.default.appendFileSync(outputFile, message + '\n');
    }
}
// If this file is run directly, execute the check
if (require.main === module) {
    checkRewardsThresholds()
        .then(claimed => {
        if (claimed) {
            console.log('✅ Successfully processed claim');
        }
        else {
            console.log('ℹ️ No claim processed');
        }
        process.exit(0);
    })
        .catch(error => {
        console.error('❌ Error executing auto claim check:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=autoClaimChecker.js.map