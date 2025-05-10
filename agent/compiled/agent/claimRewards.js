"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAutoClaimSettings = saveAutoClaimSettings;
exports.claimRewards = claimRewards;
exports.claimRewardsFromGauges = claimRewardsFromGauges;
var ethers_1 = require("ethers");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var dotenv = __importStar(require("dotenv"));
var readPositions_1 = require("./readPositions"); // Import from readPositions.ts
dotenv.config();
// Known tokens with descriptions
var KNOWN_TOKENS = {
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
var GAUGE_ABI = [
    "function balanceOf(address user) external view returns (uint256)",
    "function claim_rewards(address user) external",
    "function claimable_reward(address user, address token) external view returns (uint256)",
    "function reward_tokens(uint256 index) external view returns (address)",
    "function reward_count() external view returns (uint256)"
];
var ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];
// Balancer contract addresses
var BAL_TOKEN = "0xba100000625a3754423978a60c9317c58a424e3D"; // Balancer governance token
var WETH_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Wrapped ETH
// Initialize provider and wallet from environment variables
var provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
var wallet = process.env.PRIVATE_KEY
    ? new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;
// File paths
var CLAIM_LOG_FILE = path.join(process.cwd(), "data", "auto_claim_logs", "claim_".concat(new Date().toISOString().replace(/[:.]/g, '-'), ".json"));
// Gas price threshold for claims (in gwei)
var MAX_GAS_PRICE_GWEI = 100; // Don't claim if gas price is above 100 gwei
// Minimum reward value in USD to make claiming worth it
var MIN_REWARD_VALUE_USD = 1.0; // Minimum $1 to claim
// Auto claim settings storage file
var AUTO_CLAIM_SETTINGS_FILE = path.join(process.cwd(), "data", "auto_claim_settings.json");
// Default settings
var DEFAULT_AUTO_CLAIM_SETTINGS = {
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
var GAS_UNITS_PER_CLAIM = 150000;
var GAS_UNITS_PER_STAKE = 150000;
// Time-value optimization parameters
var WEEKLY_APY_ASSUMPTION = 0.05; // 5% weekly APY as baseline
var DAYS_PER_WEEK = 7;
/**
 * Load auto claim settings from file or return defaults
 */
function loadAutoClaimSettings() {
    var _a, _b, _c, _d, _e;
    try {
        var dataDir = path.dirname(AUTO_CLAIM_SETTINGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (fs.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
            var data = fs.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
            var settings = JSON.parse(data);
            // Validate settings - use defaults for any missing values
            return {
                minRewards: (_a = settings.minRewards) !== null && _a !== void 0 ? _a : DEFAULT_AUTO_CLAIM_SETTINGS.minRewards,
                gasAware: (_b = settings.gasAware) !== null && _b !== void 0 ? _b : DEFAULT_AUTO_CLAIM_SETTINGS.gasAware,
                compoundAware: (_c = settings.compoundAware) !== null && _c !== void 0 ? _c : DEFAULT_AUTO_CLAIM_SETTINGS.compoundAware,
                timePeriod: (_d = settings.timePeriod) !== null && _d !== void 0 ? _d : DEFAULT_AUTO_CLAIM_SETTINGS.timePeriod,
                setAt: (_e = settings.setAt) !== null && _e !== void 0 ? _e : DEFAULT_AUTO_CLAIM_SETTINGS.setAt
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
        var dataDir = path.dirname(AUTO_CLAIM_SETTINGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Merge with existing settings
        var currentSettings = loadAutoClaimSettings();
        var newSettings = __assign(__assign(__assign({}, currentSettings), settings), { setAt: new Date().toISOString() });
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
    var setDate = new Date(settings.setAt);
    var currentDate = new Date();
    var diffTime = Math.abs(currentDate.getTime() - setDate.getTime());
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Convert time period from weeks to days
    var timePeriodDays = settings.timePeriod * 7;
    return diffDays <= timePeriodDays;
}
/**
 * Main function to claim rewards from all gauges
 * @param walletAddress Optional wallet address to read/claim rewards for (overrides private key wallet)
 * @param useDelegation Boolean indicating whether to use delegation for executing transactions
 * @param delegationContractAddress Optional delegation contract address
 */
function claimRewards(walletAddress_1) {
    return __awaiter(this, arguments, void 0, function (walletAddress, useDelegation, delegationContractAddress) {
        var autoClaimSettings, isAutoClaimActive, minRewardsThreshold, gasAwareThreshold, compoundAwareThreshold, currentGasPriceGwei, estimatedGasCostPerOp, gasPrice, ethPriceUSD, totalGasUnits, claimLog, positionData_1, rewardsWorthClaiming, userAddress_1, _a, _b, expectedWeeklyYield, expectedDailyYield, daysToBreakEven, compoundYieldRatio, error_1, userAddress, _c, _d, GAUGE_ADDRESS, gauge, balance, gaugeRewards, balToken, balSymbol, balDecimals, rewardCount, i, tokenAddress, token, symbol, decimals, claimableAmount, formattedAmount, error_2, error_3, claimableBAL, formattedAmount, error_4, knownTokens, _i, knownTokens_1, tokenAddress, token, symbol, decimals, claimable, formattedAmount, error_5, tx, _e, gaugeRewards_1, reward, valueUSD, totalClaimedUSD, netProfit, error_6, error_7;
        var _f;
        if (useDelegation === void 0) { useDelegation = false; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("\n".concat("=".repeat(60)));
                    console.log("\uD83E\uDD16 AUTO-COMPOUND AI: CLAIM REWARDS");
                    console.log("".concat("=".repeat(60), "\n"));
                    // When a wallet address is provided, log it
                    if (walletAddress) {
                        console.log("Using provided wallet address: ".concat(walletAddress));
                    }
                    // If using delegation, log it
                    if (useDelegation) {
                        console.log("Using delegation for executing transactions");
                        if (delegationContractAddress) {
                            console.log("Delegation contract: ".concat(delegationContractAddress));
                        }
                    }
                    autoClaimSettings = loadAutoClaimSettings();
                    isAutoClaimActive = areAutoClaimSettingsActive(autoClaimSettings);
                    minRewardsThreshold = isAutoClaimActive ? autoClaimSettings.minRewards : MIN_REWARD_VALUE_USD;
                    gasAwareThreshold = isAutoClaimActive ? autoClaimSettings.gasAware : 1.2;
                    compoundAwareThreshold = isAutoClaimActive ? autoClaimSettings.compoundAware : 1.5;
                    console.log("📊 USING CLAIM THRESHOLDS:");
                    console.log("   Minimum rewards: $".concat(minRewardsThreshold.toFixed(4), " USD"));
                    console.log("   Gas awareness: ".concat(gasAwareThreshold.toFixed(2), "x gas cost"));
                    console.log("   Compound awareness: ".concat(compoundAwareThreshold.toFixed(2), "x gas cost"));
                    if (isAutoClaimActive) {
                        console.log("   Auto claim settings are active (set ".concat(Math.floor((new Date().getTime() - new Date(autoClaimSettings.setAt).getTime()) / (1000 * 60 * 60 * 24)), " days ago, valid for ").concat(autoClaimSettings.timePeriod, " weeks)"));
                    }
                    else if (autoClaimSettings.setAt !== DEFAULT_AUTO_CLAIM_SETTINGS.setAt) {
                        console.log("   Auto claim settings have expired (set ".concat(Math.floor((new Date().getTime() - new Date(autoClaimSettings.setAt).getTime()) / (1000 * 60 * 60 * 24)), " days ago)"));
                    }
                    currentGasPriceGwei = 0;
                    estimatedGasCostPerOp = 0;
                    return [4 /*yield*/, provider.getFeeData()];
                case 1:
                    gasPrice = _g.sent();
                    currentGasPriceGwei = parseFloat(ethers_1.ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"));
                    ethPriceUSD = 1800;
                    totalGasUnits = GAS_UNITS_PER_CLAIM + GAS_UNITS_PER_STAKE;
                    estimatedGasCostPerOp = totalGasUnits * currentGasPriceGwei * 1e-9 * ethPriceUSD;
                    console.log("\n\u26FD Current gas price: ".concat(currentGasPriceGwei.toFixed(2), " gwei"));
                    console.log("\uD83D\uDCB0 Estimated cost for claim + restake: $".concat(estimatedGasCostPerOp.toFixed(2)));
                    console.log("   \u2022 Claim: $".concat((GAS_UNITS_PER_CLAIM * currentGasPriceGwei * 1e-9 * ethPriceUSD).toFixed(2)));
                    console.log("   \u2022 Restake: $".concat((GAS_UNITS_PER_STAKE * currentGasPriceGwei * 1e-9 * ethPriceUSD).toFixed(2)));
                    if (currentGasPriceGwei > MAX_GAS_PRICE_GWEI) {
                        console.log("\u274C Gas price too high! Maximum allowed: ".concat(MAX_GAS_PRICE_GWEI, " gwei"));
                        console.log("   Aborting claim operation to save on transaction costs.");
                        return [2 /*return*/];
                    }
                    claimLog = {
                        timestamp: new Date().toISOString(),
                        claims: [],
                        summary: {
                            totalClaimed: 0,
                            totalGasCost: 0,
                            netProfit: 0,
                            errors: []
                        }
                    };
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 49, , 50]);
                    // Read staking positions using readPositions function
                    console.log("🔍 READING CURRENT POSITIONS AND REWARDS...");
                    rewardsWorthClaiming = false;
                    _g.label = 3;
                case 3:
                    _g.trys.push([3, 10, , 11]);
                    _a = walletAddress;
                    if (_a) return [3 /*break*/, 7];
                    if (!wallet) return [3 /*break*/, 5];
                    return [4 /*yield*/, wallet.getAddress()];
                case 4:
                    _b = _g.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _b = undefined;
                    _g.label = 6;
                case 6:
                    _a = (_b);
                    _g.label = 7;
                case 7:
                    userAddress_1 = _a;
                    if (!userAddress_1) return [3 /*break*/, 9];
                    return [4 /*yield*/, (0, readPositions_1.readStakingPosition)(userAddress_1)];
                case 8:
                    positionData_1 = (_g.sent());
                    // When displaying rewards, add more detailed information
                    if (positionData_1) {
                        console.log("\n🔄 REWARD TOKENS EXPLANATION:");
                        // Check if BAL rewards exist
                        if (positionData_1.rewards.BAL) {
                            console.log("\n\uD83D\uDCCA BAL (".concat(KNOWN_TOKENS.BAL.address, "):"));
                            console.log("   Amount: ".concat(positionData_1.rewards.BAL.amount, " BAL"));
                            console.log("   Value: $".concat((parseFloat(positionData_1.rewards.BAL.amount) * KNOWN_TOKENS.BAL.price).toFixed(4)));
                            console.log("   Current Price: $".concat(KNOWN_TOKENS.BAL.price.toFixed(2), " per BAL"));
                            console.log("   Description: ".concat(KNOWN_TOKENS.BAL.description));
                            console.log("   Usage: Can be held for governance voting, staked, or sold for other assets.");
                        }
                        // Check if GHO rewards exist
                        if (positionData_1.rewards.GHO) {
                            console.log("\n\uD83D\uDCB0 GHO (".concat(KNOWN_TOKENS.GHO.address, "):"));
                            console.log("   Amount: ".concat(positionData_1.rewards.GHO.amount, " GHO"));
                            console.log("   Value: $".concat((parseFloat(positionData_1.rewards.GHO.amount) * KNOWN_TOKENS.GHO.price).toFixed(4)));
                            console.log("   Current Price: $".concat(KNOWN_TOKENS.GHO.price.toFixed(2), " per GHO"));
                            console.log("   Description: ".concat(KNOWN_TOKENS.GHO.description));
                            console.log("   Usage: Can be used as a stablecoin for trading, lending, or directly as an LP asset.");
                        }
                        // Restaking explanation
                        console.log("\n\u267B\uFE0F RESTAKING EXPLANATION:");
                        console.log("   To restake in this pool (Aave GHO/USDT/USDC), you would need to:");
                        console.log("   1. Convert some rewards to GHO, USDT, and USDC in the right proportions");
                        console.log("   2. Add liquidity to the Balancer pool to receive LP tokens");
                        console.log("   3. Stake those LP tokens in the gauge again");
                        console.log("   Alternatively, you can use the rewards for other purposes in the DeFi ecosystem.");
                    }
                    // Evaluate if rewards are worth claiming based on gas cost and time value
                    console.log("\n\uD83D\uDCB0 TOTAL CLAIMABLE REWARDS: $".concat(positionData_1.totalRewardsUSD.toFixed(2)));
                    // Apply min reward threshold check
                    if (positionData_1.totalRewardsUSD < minRewardsThreshold) {
                        console.log("\u274C Rewards too small to claim (less than $".concat(minRewardsThreshold.toFixed(2), ")"));
                        rewardsWorthClaiming = false;
                    }
                    // Apply gas aware threshold check (reward/gas ratio)
                    else if ((positionData_1.totalRewardsUSD / estimatedGasCostPerOp) < gasAwareThreshold) {
                        console.log("\u274C Rewards/gas ratio (".concat((positionData_1.totalRewardsUSD / estimatedGasCostPerOp).toFixed(2), ") is less than threshold (").concat(gasAwareThreshold.toFixed(2), ")"));
                        console.log("   Rewards: $".concat(positionData_1.totalRewardsUSD.toFixed(2), ", Gas cost: $").concat(estimatedGasCostPerOp.toFixed(2)));
                        console.log("   Skipping claim operation to avoid net loss.");
                        rewardsWorthClaiming = false;
                    }
                    // Apply compound aware threshold check (expected compound reward/gas ratio)
                    else {
                        expectedWeeklyYield = positionData_1.totalRewardsUSD * WEEKLY_APY_ASSUMPTION;
                        expectedDailyYield = expectedWeeklyYield / 7;
                        daysToBreakEven = estimatedGasCostPerOp / expectedDailyYield;
                        compoundYieldRatio = expectedWeeklyYield / estimatedGasCostPerOp;
                        console.log("\uD83D\uDCC8 EXPECTED COMPOUND YIELD:");
                        console.log("   Weekly yield: $".concat(expectedWeeklyYield.toFixed(4), " (").concat((WEEKLY_APY_ASSUMPTION * 100).toFixed(2), "% of $").concat(positionData_1.totalRewardsUSD.toFixed(2), ")"));
                        console.log("   Daily yield: $".concat(expectedDailyYield.toFixed(4)));
                        console.log("   Days to break even on gas cost: ".concat(daysToBreakEven.toFixed(1)));
                        console.log("   Compound yield / gas ratio: ".concat(compoundYieldRatio.toFixed(4), " (threshold: ").concat(compoundAwareThreshold.toFixed(2), ")"));
                        if (compoundYieldRatio < compoundAwareThreshold) {
                            console.log("\u274C Expected compound yield / gas ratio (".concat(compoundYieldRatio.toFixed(4), ") is less than threshold (").concat(compoundAwareThreshold.toFixed(2), ")"));
                            console.log("   Skipping claim operation as compounding is not efficient enough.");
                            rewardsWorthClaiming = false;
                        }
                        else {
                            // All checks have passed
                            console.log("\u2705 Reward checks passed: Amount: $".concat(positionData_1.totalRewardsUSD.toFixed(2), ", Reward/gas: ").concat((positionData_1.totalRewardsUSD / estimatedGasCostPerOp).toFixed(2), ", Compound yield/gas: ").concat(compoundYieldRatio.toFixed(4)));
                            console.log("   Net profit (after gas): $".concat((positionData_1.totalRewardsUSD - estimatedGasCostPerOp).toFixed(2)));
                            console.log("   Proceeding with claim operation.");
                            rewardsWorthClaiming = true;
                        }
                    }
                    if (!rewardsWorthClaiming) {
                        return [2 /*return*/];
                    }
                    _g.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_1 = _g.sent();
                    console.error("Error reading positions:", error_1);
                    return [2 /*return*/];
                case 11:
                    if (!rewardsWorthClaiming) {
                        console.log("❌ Skipping claim operation as rewards are not worth claiming.");
                        return [2 /*return*/];
                    }
                    // Claim rewards from the pool with the current gauge
                    console.log("\n🧮 CLAIMING REWARDS...");
                    _c = walletAddress;
                    if (_c) return [3 /*break*/, 15];
                    if (!wallet) return [3 /*break*/, 13];
                    return [4 /*yield*/, wallet.getAddress()];
                case 12:
                    _d = _g.sent();
                    return [3 /*break*/, 14];
                case 13:
                    _d = undefined;
                    _g.label = 14;
                case 14:
                    _c = (_d);
                    _g.label = 15;
                case 15:
                    userAddress = _c;
                    if (!userAddress) {
                        console.log("❌ No wallet address available for claiming.");
                        return [2 /*return*/];
                    }
                    // If wallet not provided, we can't execute transactions
                    if (!wallet) {
                        console.warn("⚠️ Wallet private key not provided. Can only read data but cannot perform transactions.");
                        console.warn("   To claim rewards, provide the PRIVATE_KEY in .env");
                        return [2 /*return*/];
                    }
                    GAUGE_ADDRESS = "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f";
                    _g.label = 16;
                case 16:
                    _g.trys.push([16, 47, , 48]);
                    gauge = new ethers_1.ethers.Contract(GAUGE_ADDRESS, GAUGE_ABI, wallet);
                    return [4 /*yield*/, gauge.balanceOf(userAddress)];
                case 17:
                    balance = _g.sent();
                    if (balance == 0n) {
                        console.log("   No balance found in gauge ".concat(GAUGE_ADDRESS));
                        return [2 /*return*/];
                    }
                    console.log("   Found ".concat(ethers_1.ethers.formatEther(balance), " LP tokens in gauge"));
                    gaugeRewards = [];
                    balToken = new ethers_1.ethers.Contract(BAL_TOKEN, ERC20_ABI, provider);
                    return [4 /*yield*/, balToken.symbol()];
                case 18:
                    balSymbol = _g.sent();
                    return [4 /*yield*/, balToken.decimals()];
                case 19:
                    balDecimals = _g.sent();
                    _g.label = 20;
                case 20:
                    _g.trys.push([20, 31, , 44]);
                    return [4 /*yield*/, gauge.reward_count()];
                case 21:
                    rewardCount = _g.sent();
                    console.log("   Gauge has ".concat(rewardCount, " reward tokens"));
                    i = 0;
                    _g.label = 22;
                case 22:
                    if (!(i < Number(rewardCount))) return [3 /*break*/, 30];
                    _g.label = 23;
                case 23:
                    _g.trys.push([23, 28, , 29]);
                    return [4 /*yield*/, gauge.reward_tokens(i)];
                case 24:
                    tokenAddress = _g.sent();
                    token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, provider);
                    return [4 /*yield*/, token.symbol()];
                case 25:
                    symbol = _g.sent();
                    return [4 /*yield*/, token.decimals()];
                case 26:
                    decimals = _g.sent();
                    return [4 /*yield*/, gauge.claimable_reward(userAddress, tokenAddress)];
                case 27:
                    claimableAmount = _g.sent();
                    if (claimableAmount > 0n) {
                        formattedAmount = ethers_1.ethers.formatUnits(claimableAmount, decimals);
                        console.log("   Claimable ".concat(symbol, ": ").concat(formattedAmount));
                        gaugeRewards.push({
                            token: tokenAddress,
                            symbol: symbol,
                            decimals: decimals,
                            amount: claimableAmount
                        });
                    }
                    return [3 /*break*/, 29];
                case 28:
                    error_2 = _g.sent();
                    console.warn("   Failed to check reward at index ".concat(i));
                    return [3 /*break*/, 29];
                case 29:
                    i++;
                    return [3 /*break*/, 22];
                case 30: return [3 /*break*/, 44];
                case 31:
                    error_3 = _g.sent();
                    console.warn("   Failed to check reward count, falling back to known tokens");
                    _g.label = 32;
                case 32:
                    _g.trys.push([32, 34, , 35]);
                    return [4 /*yield*/, gauge.claimable_reward(userAddress, BAL_TOKEN)];
                case 33:
                    claimableBAL = _g.sent();
                    if (claimableBAL > 0n) {
                        formattedAmount = ethers_1.ethers.formatUnits(claimableBAL, balDecimals);
                        console.log("   Claimable ".concat(balSymbol, ": ").concat(formattedAmount));
                        gaugeRewards.push({
                            token: BAL_TOKEN,
                            symbol: balSymbol,
                            decimals: balDecimals,
                            amount: claimableBAL
                        });
                    }
                    return [3 /*break*/, 35];
                case 34:
                    error_4 = _g.sent();
                    console.warn("   Failed to check BAL rewards: ".concat(error_4.message));
                    return [3 /*break*/, 35];
                case 35:
                    knownTokens = [
                        "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", // GHO
                    ];
                    _i = 0, knownTokens_1 = knownTokens;
                    _g.label = 36;
                case 36:
                    if (!(_i < knownTokens_1.length)) return [3 /*break*/, 43];
                    tokenAddress = knownTokens_1[_i];
                    _g.label = 37;
                case 37:
                    _g.trys.push([37, 41, , 42]);
                    token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, provider);
                    return [4 /*yield*/, token.symbol()];
                case 38:
                    symbol = _g.sent();
                    return [4 /*yield*/, token.decimals()];
                case 39:
                    decimals = _g.sent();
                    return [4 /*yield*/, gauge.claimable_reward(userAddress, tokenAddress)];
                case 40:
                    claimable = _g.sent();
                    if (claimable > 0n) {
                        formattedAmount = ethers_1.ethers.formatUnits(claimable, decimals);
                        console.log("   Claimable ".concat(symbol, ": ").concat(formattedAmount));
                        gaugeRewards.push({
                            token: tokenAddress,
                            symbol: symbol,
                            decimals: decimals,
                            amount: claimable
                        });
                    }
                    return [3 /*break*/, 42];
                case 41:
                    error_5 = _g.sent();
                    console.warn("   Failed to check rewards for token ".concat(tokenAddress));
                    return [3 /*break*/, 42];
                case 42:
                    _i++;
                    return [3 /*break*/, 36];
                case 43: return [3 /*break*/, 44];
                case 44:
                    // Skip if no rewards to claim
                    if (gaugeRewards.length === 0) {
                        console.log("   No rewards to claim from gauge");
                        return [2 /*return*/];
                    }
                    // Claim all rewards
                    console.log("   Claiming rewards from gauge...");
                    return [4 /*yield*/, gauge.claim_rewards(userAddress)];
                case 45:
                    tx = _g.sent();
                    console.log("   Transaction submitted: ".concat(tx.hash));
                    console.log("   Waiting for transaction confirmation...");
                    return [4 /*yield*/, tx.wait()];
                case 46:
                    _g.sent();
                    console.log("   Transaction confirmed!");
                    // Log the claimed rewards
                    for (_e = 0, gaugeRewards_1 = gaugeRewards; _e < gaugeRewards_1.length; _e++) {
                        reward = gaugeRewards_1[_e];
                        valueUSD = ((_f = positionData_1 === null || positionData_1 === void 0 ? void 0 : positionData_1.rewards[reward.symbol]) === null || _f === void 0 ? void 0 : _f.valueUSD) || 0;
                        console.log("     Claimed ".concat(ethers_1.ethers.formatUnits(reward.amount, reward.decimals), " ").concat(reward.symbol, " ($").concat(valueUSD.toFixed(2), ")"));
                    }
                    // Update claim log
                    claimLog.claims.push({
                        gaugeAddress: GAUGE_ADDRESS,
                        rewards: gaugeRewards.map(function (reward) {
                            var _a;
                            return ({
                                token: reward.token,
                                symbol: reward.symbol,
                                amount: reward.amount.toString(),
                                valueUSD: ((_a = positionData_1 === null || positionData_1 === void 0 ? void 0 : positionData_1.rewards[reward.symbol]) === null || _a === void 0 ? void 0 : _a.valueUSD) || 0
                            });
                        })
                    });
                    totalClaimedUSD = (positionData_1 === null || positionData_1 === void 0 ? void 0 : positionData_1.totalRewardsUSD) || 0;
                    netProfit = totalClaimedUSD - estimatedGasCostPerOp;
                    claimLog.summary.totalClaimed = totalClaimedUSD;
                    claimLog.summary.totalGasCost = estimatedGasCostPerOp;
                    claimLog.summary.netProfit = netProfit;
                    console.log("\n\u2705 CLAIM OPERATION COMPLETED SUCCESSFULLY");
                    console.log("   Total USD value claimed: $".concat(totalClaimedUSD.toFixed(2)));
                    console.log("   Estimated gas cost (claim + restake): $".concat(estimatedGasCostPerOp.toFixed(2)));
                    console.log("   Net profit: $".concat(netProfit.toFixed(2)));
                    return [3 /*break*/, 48];
                case 47:
                    error_6 = _g.sent();
                    console.error("\u274C ERROR DURING CLAIM OPERATION: ".concat(error_6));
                    claimLog.summary.errors.push(String(error_6));
                    return [3 /*break*/, 48];
                case 48: return [3 /*break*/, 50];
                case 49:
                    error_7 = _g.sent();
                    console.error("❌ ERROR DURING EXECUTION:", error_7);
                    claimLog.summary.errors.push(String(error_7));
                    return [3 /*break*/, 50];
                case 50:
                    // Save claim log
                    saveClaimLog(claimLog);
                    console.log("\n\uD83D\uDCDD Claim log saved to ".concat(CLAIM_LOG_FILE));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Save claim log to file
 */
function saveClaimLog(log) {
    try {
        // Ensure directory exists
        var dir = path.dirname(CLAIM_LOG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CLAIM_LOG_FILE, JSON.stringify(log, null, 2));
    }
    catch (error) {
        console.error("Failed to save claim log: ".concat(error));
    }
}
/**
 * Calculate USD value for a token (simplified for demo purposes)
 */
function calculateUSDValue(tokenAddress, amount, decimals) {
    // In a real implementation, we would use an oracle or price feed
    // For this demo, we're using a simplified approach with hard-coded prices
    var tokenPriceUSD = 0;
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
function claimRewardsFromGauges(gaugeAddresses_1, walletAddress_1) {
    return __awaiter(this, arguments, void 0, function (gaugeAddresses, walletAddress, useDelegation, delegationContractAddress) {
        var executeClaimWithDelegation, rewardTokensPerGauge, _i, gaugeAddresses_2, gauge, txHash, provider_1, userWallet, _a, gaugeABI, results, _b, gaugeAddresses_3, gaugeAddress, gaugeContract, tx, claimForAddress, _c, error_8, receipt, error_9, error_10;
        if (useDelegation === void 0) { useDelegation = false; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 18, , 19]);
                    console.log("Claiming rewards from ".concat(gaugeAddresses.length, " gauges"));
                    if (!(useDelegation && delegationContractAddress)) return [3 /*break*/, 2];
                    console.log("Using delegation contract at ".concat(delegationContractAddress));
                    executeClaimWithDelegation = require('./delegatedClaiming').executeClaimWithDelegation;
                    if (!walletAddress) {
                        throw new Error("Wallet address is required when using delegation");
                    }
                    rewardTokensPerGauge = [];
                    // For each gauge, identify all reward tokens (simplified implementation)
                    for (_i = 0, gaugeAddresses_2 = gaugeAddresses; _i < gaugeAddresses_2.length; _i++) {
                        gauge = gaugeAddresses_2[_i];
                        // For this simplified version, we'll use common reward tokens
                        // In a full implementation, you'd query each gauge for its specific reward tokens
                        rewardTokensPerGauge.push([
                            "0xba100000625a3754423978a60c9317c58a424e3D", // BAL
                            "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f" // GHO
                        ]);
                    }
                    return [4 /*yield*/, executeClaimWithDelegation(walletAddress, gaugeAddresses, rewardTokensPerGauge, delegationContractAddress)];
                case 1:
                    txHash = _d.sent();
                    // Return a standard response
                    return [2 /*return*/, {
                            transactionHash: txHash,
                            blockNumber: 0 // Not available when using delegation
                        }];
                case 2:
                    provider_1 = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC || "");
                    userWallet = void 0;
                    // If a wallet address is provided but no private key, we can't perform the claim
                    if (walletAddress && !process.env.PRIVATE_KEY) {
                        throw new Error("PRIVATE_KEY environment variable is required for claiming rewards");
                    }
                    // Always use the PRIVATE_KEY for signing transactions
                    if (!process.env.PRIVATE_KEY) {
                        throw new Error("PRIVATE_KEY environment variable is required for claiming rewards");
                    }
                    userWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider_1);
                    _a = walletAddress;
                    if (!_a) return [3 /*break*/, 4];
                    return [4 /*yield*/, userWallet.getAddress()];
                case 3:
                    _a = (_d.sent()).toLowerCase() !== walletAddress.toLowerCase();
                    _d.label = 4;
                case 4:
                    // Verify that the wallet address matches the expected one
                    if (_a) {
                        console.warn("Warning: Provided wallet address ".concat(walletAddress, " doesn't match the address from PRIVATE_KEY"));
                        // Continue anyway, using the private key wallet for signing but claiming to the provided address
                    }
                    gaugeABI = [
                        'function claim_rewards(address user)',
                        'function claim_rewards()'
                    ];
                    results = [];
                    _b = 0, gaugeAddresses_3 = gaugeAddresses;
                    _d.label = 5;
                case 5:
                    if (!(_b < gaugeAddresses_3.length)) return [3 /*break*/, 17];
                    gaugeAddress = gaugeAddresses_3[_b];
                    _d.label = 6;
                case 6:
                    _d.trys.push([6, 15, , 16]);
                    console.log("Claiming rewards from gauge ".concat(gaugeAddress));
                    gaugeContract = new ethers_1.ethers.Contract(gaugeAddress, gaugeABI, userWallet);
                    tx = void 0;
                    _d.label = 7;
                case 7:
                    _d.trys.push([7, 11, , 13]);
                    _c = walletAddress;
                    if (_c) return [3 /*break*/, 9];
                    return [4 /*yield*/, userWallet.getAddress()];
                case 8:
                    _c = (_d.sent());
                    _d.label = 9;
                case 9:
                    claimForAddress = _c;
                    return [4 /*yield*/, gaugeContract.claim_rewards(claimForAddress)];
                case 10:
                    tx = _d.sent();
                    return [3 /*break*/, 13];
                case 11:
                    error_8 = _d.sent();
                    // If the first method fails, try the one without parameters
                    console.log("Fallback to no-parameter claim method for gauge ".concat(gaugeAddress));
                    return [4 /*yield*/, gaugeContract.claim_rewards()];
                case 12:
                    tx = _d.sent();
                    return [3 /*break*/, 13];
                case 13:
                    console.log("Transaction sent: ".concat(tx.hash));
                    return [4 /*yield*/, tx.wait()];
                case 14:
                    receipt = _d.sent();
                    console.log("Transaction confirmed in block ".concat(receipt.blockNumber));
                    results.push({
                        gauge: gaugeAddress,
                        transactionHash: receipt.hash,
                        blockNumber: receipt.blockNumber,
                        status: receipt.status
                    });
                    return [3 /*break*/, 16];
                case 15:
                    error_9 = _d.sent();
                    console.error("Error claiming from gauge ".concat(gaugeAddress, ":"), error_9);
                    throw error_9;
                case 16:
                    _b++;
                    return [3 /*break*/, 5];
                case 17: 
                // Return the hash of the last transaction as a success indicator
                return [2 /*return*/, {
                        transactionHash: results[results.length - 1].transactionHash,
                        blockNumber: results[results.length - 1].blockNumber
                    }];
                case 18:
                    error_10 = _d.sent();
                    console.error('Error claiming rewards:', error_10);
                    throw error_10;
                case 19: return [2 /*return*/];
            }
        });
    });
}
// If this file is run directly, execute the agent
if (require.main === module) {
    var args = process.argv.slice(2);
    var isMockMode = args.includes('--mock') || !args.includes('--live');
    // Extract address parameter
    var addressArg = args.find(function (arg) { return arg.startsWith('--address='); });
    var walletAddress = addressArg ? addressArg.split('=')[1] : undefined;
    // Extract delegation parameters
    var useDelegation = args.includes('--use-delegation') || args.includes('--delegation');
    var delegationArg = args.find(function (arg) { return arg.startsWith('--delegation-contract='); });
    var delegationContractAddress = delegationArg ? delegationArg.split('=')[1] : undefined;
    claimRewards(walletAddress, useDelegation, delegationContractAddress)
        .then(function () {
        console.log("\nClaim operation completed.");
        process.exit(0);
    })
        .catch(function (error) {
        console.error("\nClaim operation failed:", error);
        process.exit(1);
    });
}
exports.default = claimRewards;
