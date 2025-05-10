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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRewardsThresholds = checkRewardsThresholds;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var ethers_1 = require("ethers");
var dotenv = __importStar(require("dotenv"));
var readPositions_1 = require("./readPositions");
var claimRewards_1 = require("./claimRewards");
var balancerUtils_1 = require("../utils/balancerUtils");
var delegatedClaiming_1 = require("./delegatedClaiming");
var axios_1 = __importDefault(require("axios"));
dotenv.config();
// Path to the auto claim settings file
var AUTO_CLAIM_SETTINGS_FILE = path_1.default.join(process.cwd(), "data", "auto_claim_settings.json");
// Path to the last check log
var LAST_CHECK_LOG_FILE = path_1.default.join(process.cwd(), "data", "auto_claim_check_logs", "last_check.json");
// Default settings
var DEFAULT_AUTO_CLAIM_SETTINGS = {
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
    var _a, _b, _c, _d, _e;
    try {
        if (fs_1.default.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
            var data = fs_1.default.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
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
    var setDate = new Date(settings.setAt);
    var currentDate = new Date();
    var diffTime = Math.abs(currentDate.getTime() - setDate.getTime());
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Convert time period from weeks to days
    var timePeriodDays = settings.timePeriod * 7;
    return diffDays <= timePeriodDays;
}
// Save the check log
function saveCheckLog(log) {
    try {
        var dirPath = path_1.default.dirname(LAST_CHECK_LOG_FILE);
        ensureDirectoryExists(dirPath);
        // Also save a timestamped copy
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        var timestampedLogFile = path_1.default.join(dirPath, "check_".concat(timestamp, ".json"));
        fs_1.default.writeFileSync(LAST_CHECK_LOG_FILE, JSON.stringify(log, null, 2));
        fs_1.default.writeFileSync(timestampedLogFile, JSON.stringify(log, null, 2));
    }
    catch (error) {
        console.error("Failed to save check log: ".concat(error));
    }
}
// Calculate gas costs for claim and restake operations
function calculateGasCosts() {
    return __awaiter(this, void 0, void 0, function () {
        var rpcUrl, provider, GAS_UNITS_PER_CLAIM, GAS_UNITS_PER_STAKE, ETH_PRICE_USD, response, error_1, gasPrice, currentGasPriceGwei, claimGasCost, stakeGasCost, totalGasCost;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rpcUrl = process.env.ETHEREUM_RPC;
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    GAS_UNITS_PER_CLAIM = 150000;
                    GAS_UNITS_PER_STAKE = 150000;
                    ETH_PRICE_USD = 1800;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')];
                case 2:
                    response = _a.sent();
                    if (response.data && response.data.ethereum && response.data.ethereum.usd) {
                        ETH_PRICE_USD = response.data.ethereum.usd;
                        console.log("Fetched ETH price: $".concat(ETH_PRICE_USD));
                    }
                    else {
                        console.warn('Failed to parse ETH price from API response, using fallback price');
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.warn('Failed to fetch ETH price from CoinGecko API, using fallback price:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, provider.getFeeData()];
                case 5:
                    gasPrice = _a.sent();
                    currentGasPriceGwei = parseFloat(ethers_1.ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"));
                    claimGasCost = GAS_UNITS_PER_CLAIM * currentGasPriceGwei * 1e-9 * ETH_PRICE_USD;
                    stakeGasCost = GAS_UNITS_PER_STAKE * currentGasPriceGwei * 1e-9 * ETH_PRICE_USD;
                    totalGasCost = claimGasCost + stakeGasCost;
                    return [2 /*return*/, {
                            gasPriceGwei: currentGasPriceGwei,
                            ethPriceUsd: ETH_PRICE_USD,
                            claimGasCost: claimGasCost,
                            stakeGasCost: stakeGasCost,
                            totalGasCost: totalGasCost
                        }];
            }
        });
    });
}
// Weekly APY for compound calculations
var WEEKLY_APY_ASSUMPTION = 0.05; // 5% weekly APY
// Default configuration
var DEFAULT_CONFIG = {
    minUsdValue: 10, // $10 minimum by default
    gasAwareThreshold: 1.2, // Default gas aware threshold
    compoundAwareThreshold: 1.5, // Default compound aware threshold
    outputDir: path_1.default.join(process.cwd(), 'data', 'auto_claim_logs'),
    useDelegation: false
};
// Parse command line arguments to get configuration
function parseArgs() {
    var config = __assign({}, DEFAULT_CONFIG);
    var args = process.argv.slice(2);
    args.forEach(function (arg) {
        if (arg.startsWith('--min-value=')) {
            var value = parseFloat(arg.split('=')[1]);
            if (!isNaN(value)) {
                config.minUsdValue = value;
            }
        }
        else if (arg.startsWith('--gas-aware=')) {
            var value = parseFloat(arg.split('=')[1]);
            if (!isNaN(value)) {
                config.gasAwareThreshold = value;
            }
        }
        else if (arg.startsWith('--compound-aware=')) {
            var value = parseFloat(arg.split('=')[1]);
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
            var data = fs_1.default.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
            var settings = JSON.parse(data);
            if (settings) {
                if (settings.minRewards !== undefined) {
                    console.log("Loading min rewards from auto_claim_settings.json: ".concat(settings.minRewards));
                    config.minUsdValue = settings.minRewards;
                }
                if (settings.gasAware !== undefined) {
                    console.log("Loading gas aware threshold from auto_claim_settings.json: ".concat(settings.gasAware));
                    config.gasAwareThreshold = settings.gasAware;
                }
                if (settings.compoundAware !== undefined) {
                    console.log("Loading compound aware threshold from auto_claim_settings.json: ".concat(settings.compoundAware));
                    config.compoundAwareThreshold = settings.compoundAware;
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
function checkRewardsThresholds() {
    return __awaiter(this, void 0, void 0, function () {
        var config, timestamp, logFile, gasCosts, userAddress, errorMsg, positionData, hasStakedPosition, hasRewards, _i, _a, _b, token, data, rewardGasRatio, expectedWeeklyYield, expectedDailyYield, daysToBreakEven, compoundYieldRatio, gaugeAddresses, rewardTokensPerGauge, _loop_1, _c, COMMON_GAUGES_1, gauge, shouldClaim, transactionHash, resultFile, error_2, errorFile, error_3, claimRequest, requestFile, result, resultFile, error_4, errorFile, error_5, positions, error_6, gaugeAddresses, _d, rewards, totalUsdValue, rewardGasRatio, expectedWeeklyYield, expectedDailyYield, daysToBreakEven, compoundYieldRatio, claimRequest, requestFile, result, resultFile, error_7, errorFile, error_8;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    config = parseArgs();
                    // Ensure output directory exists
                    ensureOutputDirExists(config.outputDir);
                    timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                    logFile = path_1.default.join(config.outputDir, "check_".concat(timestamp, ".log"));
                    // Initialize the log file
                    fs_1.default.writeFileSync(logFile, "Auto Claim Check - ".concat(new Date().toISOString(), "\n"));
                    fs_1.default.appendFileSync(logFile, '----------------------------------------\n');
                    // Log configuration
                    log("Configuration:", logFile);
                    log("- Minimum USD threshold: $".concat(config.minUsdValue), logFile);
                    log("- Gas aware threshold: ".concat(config.gasAwareThreshold, "x gas cost"), logFile);
                    log("- Compound aware threshold: ".concat(config.compoundAwareThreshold, "x gas cost"), logFile);
                    if (config.address) {
                        log("- Checking address: ".concat(config.address), logFile);
                    }
                    else {
                        log("- Error: No wallet address specified", logFile);
                        return [2 /*return*/, false];
                    }
                    log('----------------------------------------', logFile);
                    return [4 /*yield*/, calculateGasCosts()];
                case 1:
                    gasCosts = _e.sent();
                    log("Current gas price: ".concat(gasCosts.gasPriceGwei.toFixed(2), " gwei"), logFile);
                    log("Estimated cost for claim + restake: $".concat(gasCosts.totalGasCost.toFixed(4)), logFile);
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 40, , 41]);
                    userAddress = void 0;
                    if (config.address) {
                        userAddress = config.address;
                        log("Using provided wallet address: ".concat(userAddress), logFile);
                    }
                    else {
                        errorMsg = 'User address not specified';
                        log("Error checking rewards: ".concat(errorMsg), logFile);
                        throw new Error(errorMsg);
                    }
                    log("Checking rewards for address: ".concat(userAddress), logFile);
                    // Use readStakingPosition to get position data - this is more reliable than getPositionsForAddress
                    log('Fetching current positions using readStakingPosition...', logFile);
                    positionData = void 0;
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 26, , 39]);
                    return [4 /*yield*/, (0, readPositions_1.readStakingPosition)(userAddress)];
                case 4:
                    positionData = _e.sent();
                    hasStakedPosition = positionData.staked && parseFloat(positionData.staked.balance) > 0;
                    hasRewards = positionData.totalRewardsUSD > 0;
                    if (!hasStakedPosition && !hasRewards) {
                        log('No positions or rewards found for this address.', logFile);
                        return [2 /*return*/, false];
                    }
                    // Log the rewards
                    if (hasRewards) {
                        log("Found claimable rewards with total value: $".concat(positionData.totalRewardsUSD.toFixed(2)), logFile);
                        log('Reward tokens:', logFile);
                        for (_i = 0, _a = Object.entries(positionData.rewards); _i < _a.length; _i++) {
                            _b = _a[_i], token = _b[0], data = _b[1];
                            log("  ".concat(token, ": ").concat(data.amount, " ($").concat(data.valueUSD.toFixed(2), ")"), logFile);
                        }
                    }
                    // Check if we've reached the threshold - now applying all three checks
                    if (positionData.totalRewardsUSD < config.minUsdValue) {
                        log("Threshold not reached. ($".concat(positionData.totalRewardsUSD.toFixed(3), " < $").concat(config.minUsdValue, ")"), logFile);
                        return [2 /*return*/, false];
                    }
                    rewardGasRatio = positionData.totalRewardsUSD / gasCosts.totalGasCost;
                    if (rewardGasRatio < config.gasAwareThreshold) {
                        log("Gas aware check failed. Reward/gas ratio ".concat(rewardGasRatio.toFixed(2), " < ").concat(config.gasAwareThreshold), logFile);
                        return [2 /*return*/, false];
                    }
                    expectedWeeklyYield = positionData.totalRewardsUSD * WEEKLY_APY_ASSUMPTION;
                    expectedDailyYield = expectedWeeklyYield / 7;
                    daysToBreakEven = gasCosts.totalGasCost / expectedDailyYield;
                    compoundYieldRatio = expectedWeeklyYield / gasCosts.totalGasCost;
                    log("Expected weekly compound yield: $".concat(expectedWeeklyYield.toFixed(4), " (").concat((WEEKLY_APY_ASSUMPTION * 100).toFixed(2), "%)"), logFile);
                    log("Expected daily compound yield: $".concat(expectedDailyYield.toFixed(4)), logFile);
                    log("Days to break even on gas cost: ".concat(daysToBreakEven.toFixed(1)), logFile);
                    log("Compound yield / gas ratio: ".concat(compoundYieldRatio.toFixed(2)), logFile);
                    if (compoundYieldRatio < config.compoundAwareThreshold) {
                        log("Compound aware check failed. Yield/gas ratio ".concat(compoundYieldRatio.toFixed(2), " < ").concat(config.compoundAwareThreshold), logFile);
                        return [2 /*return*/, false];
                    }
                    log("\uD83D\uDD14 All threshold checks passed! Initiating claim process...", logFile);
                    gaugeAddresses = readPositions_1.COMMON_GAUGES.map(function (g) { return g.gauge; });
                    if (!(config.useDelegation && config.delegationContractAddress)) return [3 /*break*/, 18];
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 17, , 18]);
                    log("Checking delegation status with contract at ".concat(config.delegationContractAddress), logFile);
                    rewardTokensPerGauge = [];
                    _loop_1 = function (gauge) {
                        var gaugeData, tokenAddresses;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0: return [4 /*yield*/, (0, balancerUtils_1.getGauges)().then(function (gauges) {
                                        return gauges.find(function (g) { return g.address.toLowerCase() === gauge.gauge.toLowerCase(); });
                                    })];
                                case 1:
                                    gaugeData = _f.sent();
                                    if (gaugeData && gaugeData.rewardTokens) {
                                        tokenAddresses = gaugeData.rewardTokens.map(function (t) { return t.tokenAddress; });
                                        rewardTokensPerGauge.push(tokenAddresses);
                                    }
                                    else {
                                        // If we can't find reward tokens, use an empty array
                                        rewardTokensPerGauge.push([]);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _c = 0, COMMON_GAUGES_1 = readPositions_1.COMMON_GAUGES;
                    _e.label = 6;
                case 6:
                    if (!(_c < COMMON_GAUGES_1.length)) return [3 /*break*/, 9];
                    gauge = COMMON_GAUGES_1[_c];
                    return [5 /*yield**/, _loop_1(gauge)];
                case 7:
                    _e.sent();
                    _e.label = 8;
                case 8:
                    _c++;
                    return [3 /*break*/, 6];
                case 9: return [4 /*yield*/, (0, delegatedClaiming_1.shouldClaimForUser)(userAddress, positionData.totalRewardsUSD, config.delegationContractAddress)];
                case 10:
                    shouldClaim = _e.sent();
                    if (!shouldClaim) return [3 /*break*/, 15];
                    log("Delegation contract confirms claiming should proceed", logFile);
                    _e.label = 11;
                case 11:
                    _e.trys.push([11, 13, , 14]);
                    log("Executing delegated claim for user ".concat(userAddress), logFile);
                    return [4 /*yield*/, (0, delegatedClaiming_1.executeClaimWithDelegation)(userAddress, gaugeAddresses, rewardTokensPerGauge, config.delegationContractAddress)];
                case 12:
                    transactionHash = _e.sent();
                    log("Delegated claim successful! Transaction hash: ".concat(transactionHash), logFile);
                    resultFile = path_1.default.join(config.outputDir, "claim_result_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(resultFile, JSON.stringify({
                        timestamp: new Date().toISOString(),
                        address: userAddress,
                        gauges: gaugeAddresses,
                        transactionHash: transactionHash,
                        delegated: true,
                        success: true
                    }, null, 2));
                    return [2 /*return*/, true];
                case 13:
                    error_2 = _e.sent();
                    log("Error executing delegated claim: ".concat(error_2.message || String(error_2)), logFile);
                    errorFile = path_1.default.join(config.outputDir, "claim_error_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(errorFile, JSON.stringify({
                        timestamp: new Date().toISOString(),
                        address: userAddress,
                        gauges: gaugeAddresses,
                        delegated: true,
                        success: false,
                        error: error_2.message || String(error_2)
                    }, null, 2));
                    return [2 /*return*/, false];
                case 14: return [3 /*break*/, 16];
                case 15:
                    log("Delegation contract indicates claiming should not proceed at this time", logFile);
                    return [2 /*return*/, false];
                case 16: return [3 /*break*/, 18];
                case 17:
                    error_3 = _e.sent();
                    log("Error using delegation: ".concat(error_3.message || String(error_3)), logFile);
                    log('Falling back to direct claiming method...', logFile);
                    return [3 /*break*/, 18];
                case 18:
                    claimRequest = {
                        timestamp: new Date().toISOString(),
                        address: userAddress,
                        gauges: gaugeAddresses,
                        rewardsValue: positionData.totalRewardsUSD
                    };
                    requestFile = path_1.default.join(config.outputDir, "claim_request_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(requestFile, JSON.stringify(claimRequest, null, 2));
                    // Execute the claim (always in live mode)
                    log('Claiming rewards now...', logFile);
                    _e.label = 19;
                case 19:
                    _e.trys.push([19, 24, , 25]);
                    result = void 0;
                    if (!(config.useDelegation && config.delegationContractAddress)) return [3 /*break*/, 21];
                    return [4 /*yield*/, (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress, true, config.delegationContractAddress)];
                case 20:
                    result = _e.sent();
                    log('Delegated claim successful!', logFile);
                    log("Transaction hash: ".concat(result.transactionHash), logFile);
                    return [3 /*break*/, 23];
                case 21: return [4 /*yield*/, (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress)];
                case 22:
                    // Traditional claim method - still pass the wallet address
                    result = _e.sent();
                    log('Claim successful!', logFile);
                    log("Transaction hash: ".concat(result.transactionHash), logFile);
                    _e.label = 23;
                case 23:
                    resultFile = path_1.default.join(config.outputDir, "claim_result_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(resultFile, JSON.stringify(__assign(__assign({}, claimRequest), { success: true, transactionHash: result.transactionHash, blockNumber: result.blockNumber }), null, 2));
                    return [3 /*break*/, 25];
                case 24:
                    error_4 = _e.sent();
                    log("Error claiming rewards: ".concat(error_4.message || String(error_4)), logFile);
                    errorFile = path_1.default.join(config.outputDir, "claim_error_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(errorFile, JSON.stringify(__assign(__assign({}, claimRequest), { success: false, error: error_4.message || String(error_4) }), null, 2));
                    return [2 /*return*/, false];
                case 25: return [2 /*return*/, true];
                case 26:
                    error_5 = _e.sent();
                    log("Error fetching positions with readStakingPosition: ".concat(error_5), logFile);
                    log('Falling back to getPositionsForAddress method...', logFile);
                    positions = [];
                    _e.label = 27;
                case 27:
                    _e.trys.push([27, 29, , 30]);
                    return [4 /*yield*/, (0, readPositions_1.getPositionsForAddress)(userAddress)];
                case 28:
                    positions = _e.sent();
                    return [3 /*break*/, 30];
                case 29:
                    error_6 = _e.sent();
                    log("Error fetching positions: ".concat(error_6), logFile);
                    log('Continuing with empty positions list', logFile);
                    positions = [];
                    return [3 /*break*/, 30];
                case 30:
                    if (!positions || positions.length === 0) {
                        log('No positions found for this address.', logFile);
                        return [2 /*return*/, false];
                    }
                    // Rest of the original implementation...
                    // Log the positions
                    log("Found ".concat(positions.length, " positions:"), logFile);
                    positions.forEach(function (pos, i) {
                        log("  ".concat(i + 1, ". ").concat(pos.symbol, " (").concat(pos.gauge, ")"), logFile);
                    });
                    gaugeAddresses = positions.map(function (pos) { return pos.gauge; });
                    // Get claimable rewards for these gauges
                    log('Checking claimable rewards...', logFile);
                    return [4 /*yield*/, getClaimableRewards(userAddress, gaugeAddresses)];
                case 31:
                    _d = _e.sent(), rewards = _d.rewards, totalUsdValue = _d.totalUsdValue;
                    // Log the rewards
                    log('Claimable rewards:', logFile);
                    Object.entries(rewards).forEach(function (_a) {
                        var gauge = _a[0], tokens = _a[1];
                        log("  Gauge ".concat(gauge, ":"), logFile);
                        if (tokens) {
                            Object.entries(tokens).forEach(function (_a) {
                                var token = _a[0], data = _a[1];
                                if (data) {
                                    log("    ".concat(token, ": ").concat(data.amount, " (").concat(data.symbol, ") = $").concat(data.usdValue.toFixed(2)), logFile);
                                }
                            });
                        }
                    });
                    log("Total claimable rewards value: $".concat(totalUsdValue.toFixed(2)), logFile);
                    // Check if we've reached the threshold - now applying all three checks
                    if (totalUsdValue < config.minUsdValue) {
                        log("Threshold not reached. ($".concat(totalUsdValue.toFixed(3), " < $").concat(config.minUsdValue, ")"), logFile);
                        return [2 /*return*/, false];
                    }
                    rewardGasRatio = totalUsdValue / gasCosts.totalGasCost;
                    if (rewardGasRatio < config.gasAwareThreshold) {
                        log("Gas aware check failed. Reward/gas ratio ".concat(rewardGasRatio.toFixed(2), " < ").concat(config.gasAwareThreshold), logFile);
                        return [2 /*return*/, false];
                    }
                    expectedWeeklyYield = totalUsdValue * WEEKLY_APY_ASSUMPTION;
                    expectedDailyYield = expectedWeeklyYield / 7;
                    daysToBreakEven = gasCosts.totalGasCost / expectedDailyYield;
                    compoundYieldRatio = expectedWeeklyYield / gasCosts.totalGasCost;
                    log("Expected weekly compound yield: $".concat(expectedWeeklyYield.toFixed(4), " (").concat((WEEKLY_APY_ASSUMPTION * 100).toFixed(2), "%)"), logFile);
                    log("Expected daily compound yield: $".concat(expectedDailyYield.toFixed(4)), logFile);
                    log("Days to break even on gas cost: ".concat(daysToBreakEven.toFixed(1)), logFile);
                    log("Compound yield / gas ratio: ".concat(compoundYieldRatio.toFixed(2)), logFile);
                    if (compoundYieldRatio < config.compoundAwareThreshold) {
                        log("Compound aware check failed. Yield/gas ratio ".concat(compoundYieldRatio.toFixed(2), " < ").concat(config.compoundAwareThreshold), logFile);
                        return [2 /*return*/, false];
                    }
                    log("\uD83D\uDD14 All threshold checks passed! Initiating claim process...", logFile);
                    claimRequest = {
                        timestamp: new Date().toISOString(),
                        address: userAddress,
                        gauges: gaugeAddresses,
                        rewardsValue: totalUsdValue
                    };
                    requestFile = path_1.default.join(config.outputDir, "claim_request_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(requestFile, JSON.stringify(claimRequest, null, 2));
                    // Execute the claim (always in live mode)
                    log('Claiming rewards now...', logFile);
                    _e.label = 32;
                case 32:
                    _e.trys.push([32, 37, , 38]);
                    result = void 0;
                    if (!(config.useDelegation && config.delegationContractAddress)) return [3 /*break*/, 34];
                    return [4 /*yield*/, (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress, true, config.delegationContractAddress)];
                case 33:
                    result = _e.sent();
                    log('Delegated claim successful!', logFile);
                    log("Transaction hash: ".concat(result.transactionHash), logFile);
                    return [3 /*break*/, 36];
                case 34: return [4 /*yield*/, (0, claimRewards_1.claimRewardsFromGauges)(gaugeAddresses, userAddress)];
                case 35:
                    // Traditional claim method - still pass the wallet address
                    result = _e.sent();
                    log('Claim successful!', logFile);
                    log("Transaction hash: ".concat(result.transactionHash), logFile);
                    _e.label = 36;
                case 36:
                    resultFile = path_1.default.join(config.outputDir, "claim_result_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(resultFile, JSON.stringify(__assign(__assign({}, claimRequest), { success: true, transactionHash: result.transactionHash, blockNumber: result.blockNumber }), null, 2));
                    return [3 /*break*/, 38];
                case 37:
                    error_7 = _e.sent();
                    log("Error claiming rewards: ".concat(error_7.message || String(error_7)), logFile);
                    errorFile = path_1.default.join(config.outputDir, "claim_error_".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(errorFile, JSON.stringify(__assign(__assign({}, claimRequest), { success: false, error: error_7.message || String(error_7) }), null, 2));
                    return [2 /*return*/, false];
                case 38: return [2 /*return*/, true];
                case 39: return [3 /*break*/, 41];
                case 40:
                    error_8 = _e.sent();
                    log("Error checking rewards: ".concat(error_8.message || String(error_8)), logFile);
                    return [2 /*return*/, false];
                case 41: return [2 /*return*/];
            }
        });
    });
}
// Function to get claimable rewards for an address from specified gauges
function getClaimableRewards(address, gaugeAddresses) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, gaugeABI, allGauges, rewards, totalUsdValue, _loop_2, _i, gaugeAddresses_1, gaugeAddress, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
                    gaugeABI = [
                        'function claimable_reward(address user, address token) external view returns (uint256)',
                        'function reward_tokens(uint256 index) external view returns (address)'
                    ];
                    return [4 /*yield*/, (0, balancerUtils_1.getGauges)()];
                case 1:
                    allGauges = _a.sent();
                    rewards = {};
                    totalUsdValue = 0;
                    _loop_2 = function (gaugeAddress) {
                        var gauge, gaugeData, _b, _c, tokenInfo, tokenAddress, claimable, formattedAmount, usdValue, error_10, index, rewardTokens, token, e_1, _d, rewardTokens_1, tokenAddress, claimable, error_11, error_12, error_13;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 22, , 23]);
                                    gauge = new ethers_1.ethers.Contract(gaugeAddress, gaugeABI, provider);
                                    rewards[gaugeAddress] = {};
                                    gaugeData = allGauges.find(function (g) { return g.address.toLowerCase() === gaugeAddress.toLowerCase(); });
                                    if (!gaugeData) {
                                        console.warn("Gauge ".concat(gaugeAddress, " not found in gauge data"));
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (!(gaugeData.rewardTokens && gaugeData.rewardTokens.length > 0)) return [3 /*break*/, 7];
                                    _b = 0, _c = gaugeData.rewardTokens;
                                    _e.label = 1;
                                case 1:
                                    if (!(_b < _c.length)) return [3 /*break*/, 6];
                                    tokenInfo = _c[_b];
                                    _e.label = 2;
                                case 2:
                                    _e.trys.push([2, 4, , 5]);
                                    tokenAddress = tokenInfo.tokenAddress;
                                    return [4 /*yield*/, gauge.claimable_reward(address, tokenAddress)];
                                case 3:
                                    claimable = _e.sent();
                                    if (claimable > 0n) {
                                        formattedAmount = ethers_1.ethers.formatUnits(claimable, tokenInfo.decimals);
                                        usdValue = parseFloat(formattedAmount) * (tokenInfo.price || 0);
                                        rewards[gaugeAddress][tokenAddress] = {
                                            amount: formattedAmount,
                                            symbol: tokenInfo.symbol,
                                            usdValue: usdValue
                                        };
                                        totalUsdValue += usdValue;
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_10 = _e.sent();
                                    console.warn("Error checking reward token ".concat(tokenInfo.symbol, " in gauge ").concat(gaugeAddress, ": ").concat(error_10));
                                    return [3 /*break*/, 5];
                                case 5:
                                    _b++;
                                    return [3 /*break*/, 1];
                                case 6: return [3 /*break*/, 21];
                                case 7:
                                    _e.trys.push([7, 20, , 21]);
                                    index = 0;
                                    rewardTokens = [];
                                    _e.label = 8;
                                case 8:
                                    if (!true) return [3 /*break*/, 13];
                                    _e.label = 9;
                                case 9:
                                    _e.trys.push([9, 11, , 12]);
                                    return [4 /*yield*/, gauge.reward_tokens(index)];
                                case 10:
                                    token = _e.sent();
                                    rewardTokens.push(token);
                                    index++;
                                    // Safety check to avoid infinite loops
                                    if (index > 20) {
                                        console.warn("Too many reward tokens for gauge ".concat(gaugeAddress, ", stopping at 20"));
                                        return [3 /*break*/, 13];
                                    }
                                    return [3 /*break*/, 12];
                                case 11:
                                    e_1 = _e.sent();
                                    // We've reached the end of the reward tokens list
                                    return [3 /*break*/, 13];
                                case 12: return [3 /*break*/, 8];
                                case 13:
                                    _d = 0, rewardTokens_1 = rewardTokens;
                                    _e.label = 14;
                                case 14:
                                    if (!(_d < rewardTokens_1.length)) return [3 /*break*/, 19];
                                    tokenAddress = rewardTokens_1[_d];
                                    _e.label = 15;
                                case 15:
                                    _e.trys.push([15, 17, , 18]);
                                    return [4 /*yield*/, gauge.claimable_reward(address, tokenAddress)];
                                case 16:
                                    claimable = _e.sent();
                                    if (claimable > 0n) {
                                        // We don't have price info for this token, so just log the raw amount
                                        rewards[gaugeAddress][tokenAddress] = {
                                            amount: ethers_1.ethers.formatEther(claimable), // Assume 18 decimals
                                            symbol: 'UNKNOWN',
                                            usdValue: 0
                                        };
                                    }
                                    return [3 /*break*/, 18];
                                case 17:
                                    error_11 = _e.sent();
                                    console.warn("Error checking reward for token ".concat(tokenAddress, " in gauge ").concat(gaugeAddress, ": ").concat(error_11));
                                    return [3 /*break*/, 18];
                                case 18:
                                    _d++;
                                    return [3 /*break*/, 14];
                                case 19: return [3 /*break*/, 21];
                                case 20:
                                    error_12 = _e.sent();
                                    console.warn("Error querying reward tokens for gauge ".concat(gaugeAddress, ": ").concat(error_12));
                                    return [3 /*break*/, 21];
                                case 21: return [3 /*break*/, 23];
                                case 22:
                                    error_13 = _e.sent();
                                    console.warn("Error processing gauge ".concat(gaugeAddress, ": ").concat(error_13));
                                    return [3 /*break*/, 23];
                                case 23: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, gaugeAddresses_1 = gaugeAddresses;
                    _a.label = 2;
                case 2:
                    if (!(_i < gaugeAddresses_1.length)) return [3 /*break*/, 5];
                    gaugeAddress = gaugeAddresses_1[_i];
                    return [5 /*yield**/, _loop_2(gaugeAddress)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, { rewards: rewards, totalUsdValue: totalUsdValue }];
                case 6:
                    error_9 = _a.sent();
                    console.error('Error getting claimable rewards:', error_9);
                    // Return empty results on error rather than failing
                    return [2 /*return*/, { rewards: {}, totalUsdValue: 0 }];
                case 7: return [2 /*return*/];
            }
        });
    });
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
        .then(function (claimed) {
        if (claimed) {
            console.log('✅ Successfully processed claim');
        }
        else {
            console.log('ℹ️ No claim processed');
        }
        process.exit(0);
    })
        .catch(function (error) {
        console.error('❌ Error executing auto claim check:', error);
        process.exit(1);
    });
}
