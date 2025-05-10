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
exports.COMMON_GAUGES = void 0;
exports.readStakingPosition = readStakingPosition;
exports.readMultiplePositions = readMultiplePositions;
exports.getPositionsForAddress = getPositionsForAddress;
exports.GET = GET;
var ethers_1 = require("ethers");
var fs = __importStar(require("fs"));
var dotenv = __importStar(require("dotenv"));
var axios_1 = __importDefault(require("axios"));
var server_1 = require("next/server");
var path_1 = __importDefault(require("path"));
dotenv.config();
var ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];
var GAUGE_ABI = [
    "function deposit(uint256 value) external",
    "function balanceOf(address) view returns (uint256)",
    "function claimable_reward(address user, address token) external view returns (uint256)",
    "function claimable_tokens(address user) external view returns (uint256)",
    "function reward_tokens(uint256 index) external view returns (address)",
    "function reward_count() external view returns (uint256)"
];
// Your pool and gauge addresses
var POOL_ADDRESS = "0x85b2b559bc2d21104c4defdd6efca8a20343361d";
var BPT_ADDRESS = "0x85b2b559bc2d21104c4defdd6efca8a20343361d"; // Using pool address as BPT address
var GAUGE_ADDRESS = "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f";
// Additional commonly used gauges to check (to be more comprehensive)
exports.COMMON_GAUGES = [
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
var BALANCER_QUERIES_ADDRESS = "0xE39B5e3B6D74016D740074C991C02070c02D567D";
var BAL_TOKEN_ADDRESS = "0xba100000625a3754423978a60c9317c58a424e3d"; // BAL token address
var GHO_TOKEN_ADDRESS = "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"; // GHO token address
// Cache for token prices to avoid multiple API calls
var tokenPriceCache = {};
// Helper to format amounts with proper decimals
function formatAmount(amount, decimals) {
    return ethers_1.ethers.formatUnits(amount, decimals);
}
/**
 * Get token price in USD
 */
function getTokenPrice(tokenAddress, tokenSymbol) {
    return __awaiter(this, void 0, void 0, function () {
        var response, price, knownTokens, error_1, knownTokens;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check cache first
                    if (tokenPriceCache[tokenAddress]) {
                        return [2 /*return*/, tokenPriceCache[tokenAddress]];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get("https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=".concat(tokenAddress, "&vs_currencies=usd"))];
                case 2:
                    response = _a.sent();
                    if (response.data && response.data[tokenAddress.toLowerCase()] && response.data[tokenAddress.toLowerCase()].usd) {
                        price = response.data[tokenAddress.toLowerCase()].usd;
                        tokenPriceCache[tokenAddress] = price;
                        return [2 /*return*/, price];
                    }
                    knownTokens = {
                        'BAL': 4.50, // Updated BAL price
                        'GHO': 0.98, // Updated GHO price
                        'USDC': 1.0,
                        'USDT': 1.0,
                        'DAI': 1.0
                    };
                    if (knownTokens[tokenSymbol]) {
                        console.log("Using fallback price for ".concat(tokenSymbol, ": $").concat(knownTokens[tokenSymbol]));
                        tokenPriceCache[tokenAddress] = knownTokens[tokenSymbol];
                        return [2 /*return*/, knownTokens[tokenSymbol]];
                    }
                    // Default fallback
                    console.log("Could not get price for ".concat(tokenSymbol, ", using $1.0 as fallback"));
                    tokenPriceCache[tokenAddress] = 1.0;
                    return [2 /*return*/, 1.0];
                case 3:
                    error_1 = _a.sent();
                    console.log("Error fetching price for ".concat(tokenSymbol, ": ").concat(error_1.message));
                    knownTokens = {
                        'BAL': 4.50, // Updated BAL price
                        'GHO': 0.98, // Updated GHO price
                        'USDC': 1.0,
                        'USDT': 1.0,
                        'DAI': 1.0
                    };
                    if (knownTokens[tokenSymbol]) {
                        console.log("Using fallback price for ".concat(tokenSymbol, ": $").concat(knownTokens[tokenSymbol]));
                        tokenPriceCache[tokenAddress] = knownTokens[tokenSymbol];
                        return [2 /*return*/, knownTokens[tokenSymbol]];
                    }
                    // Default fallback
                    tokenPriceCache[tokenAddress] = 1.0;
                    return [2 /*return*/, 1.0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get price for BPT (Balancer Pool Token)
 * This is a simplified estimate and would need pool composition data for accuracy
 */
function getBPTPrice(bptAddress, bptSymbol) {
    return __awaiter(this, void 0, void 0, function () {
        var knownPools, price, _a, error_2;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 5, , 6]);
                    knownPools = (_b = {},
                        // Simple pool price estimates
                        // Format: 'poolAddress': price
                        _b[POOL_ADDRESS.toLowerCase()] = 1.02 // Example price for a stablecoin pool
                    ,
                        _b);
                    if (knownPools[bptAddress.toLowerCase()]) {
                        return [2 /*return*/, knownPools[bptAddress.toLowerCase()]];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getTokenPrice(bptAddress, bptSymbol)];
                case 2:
                    price = _c.sent();
                    return [2 /*return*/, price];
                case 3:
                    _a = _c.sent();
                    // If that fails, provide a fallback
                    console.log("Using fallback price for ".concat(bptSymbol));
                    return [2 /*return*/, 1.0];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_2 = _c.sent();
                    console.log("Error getting BPT price: ".concat(error_2.message));
                    return [2 /*return*/, 1.0];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Read current staking position and claimable rewards
 */
function readStakingPosition(walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var rpcUrl, provider, address, wallet, network, positionResults, foundAnyPosition, _i, COMMON_GAUGES_1, gaugeInfo, bptToken, gauge, bptDecimals, bptSymbol, bptPrice, bptBalance, bptBalanceFormatted, bptValueUSD, stakedBalance, stakedBalanceFormatted, stakedValueUSD, claimableBAL, balToken, balDecimals, balFormatted, balPrice, balValueUSD, error_3, rewardCount, i, rewardTokenAddress, rewardToken, rewardSymbol, rewardDecimals, claimableReward, rewardFormatted, tokenPrice, rewardValueUSD, error_4, error_5, error_6, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rpcUrl = process.env.ETHEREUM_RPC || "https://eth.llamarpc.com";
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    console.log("\n".concat("=".repeat(60)));
                    console.log("\uD83D\uDD0D READING BALANCER STAKING POSITION");
                    console.log("".concat("=".repeat(60), "\n"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 38, , 39]);
                    address = void 0;
                    if (!walletAddress) return [3 /*break*/, 2];
                    address = walletAddress;
                    console.log("Using provided address: ".concat(address));
                    return [3 /*break*/, 5];
                case 2:
                    if (!process.env.PRIVATE_KEY) return [3 /*break*/, 4];
                    wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider);
                    return [4 /*yield*/, wallet.getAddress()];
                case 3:
                    address = _a.sent();
                    console.log("Using wallet address: ".concat(address));
                    return [3 /*break*/, 5];
                case 4:
                    if (process.env.ACCOUNT) {
                        // Support for hardhat account format
                        address = process.env.ACCOUNT;
                        console.log("Using ACCOUNT from .env: ".concat(address));
                    }
                    else {
                        throw new Error("No wallet address provided. Set PRIVATE_KEY or ACCOUNT in .env or provide an address.");
                    }
                    _a.label = 5;
                case 5: return [4 /*yield*/, provider.getNetwork()];
                case 6:
                    network = _a.sent();
                    console.log("Connected to network: ".concat(network.name, " (chainId: ").concat(network.chainId, ")\n"));
                    positionResults = {
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
                        rewards: {},
                        totalRewardsUSD: 0,
                        totalPositionValueUSD: 0
                    };
                    foundAnyPosition = false;
                    _i = 0, COMMON_GAUGES_1 = exports.COMMON_GAUGES;
                    _a.label = 7;
                case 7:
                    if (!(_i < COMMON_GAUGES_1.length)) return [3 /*break*/, 37];
                    gaugeInfo = COMMON_GAUGES_1[_i];
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 35, , 36]);
                    console.log("\nChecking gauge: ".concat(gaugeInfo.name, " (").concat(gaugeInfo.gauge, ")"));
                    bptToken = new ethers_1.ethers.Contract(gaugeInfo.pool, ERC20_ABI, provider);
                    gauge = new ethers_1.ethers.Contract(gaugeInfo.gauge, GAUGE_ABI, provider);
                    return [4 /*yield*/, bptToken.decimals()];
                case 9:
                    bptDecimals = _a.sent();
                    return [4 /*yield*/, bptToken.symbol()];
                case 10:
                    bptSymbol = _a.sent();
                    console.log("Pool Token: ".concat(bptSymbol, " (").concat(gaugeInfo.pool, ")"));
                    return [4 /*yield*/, getBPTPrice(gaugeInfo.pool, bptSymbol)];
                case 11:
                    bptPrice = _a.sent();
                    console.log("Estimated BPT Price: $".concat(bptPrice.toFixed(4)));
                    return [4 /*yield*/, bptToken.balanceOf(address)];
                case 12:
                    bptBalance = _a.sent();
                    bptBalanceFormatted = formatAmount(bptBalance, bptDecimals);
                    bptValueUSD = parseFloat(bptBalanceFormatted) * bptPrice;
                    if (bptBalance > 0n) {
                        console.log("\n\uD83D\uDCCA UNSTAKED POSITION (".concat(gaugeInfo.name, "):"));
                        console.log("".concat(bptBalanceFormatted, " ").concat(bptSymbol, " (unstaked) \u2248 $").concat(bptValueUSD.toFixed(2)));
                        positionResults.unstaked.balance = (parseFloat(positionResults.unstaked.balance) + parseFloat(bptBalanceFormatted)).toString();
                        positionResults.unstaked.token = bptSymbol;
                        positionResults.unstaked.valueUSD += bptValueUSD;
                        foundAnyPosition = true;
                    }
                    return [4 /*yield*/, gauge.balanceOf(address)];
                case 13:
                    stakedBalance = _a.sent();
                    stakedBalanceFormatted = formatAmount(stakedBalance, bptDecimals);
                    stakedValueUSD = parseFloat(stakedBalanceFormatted) * bptPrice;
                    if (!(stakedBalance > 0n)) return [3 /*break*/, 34];
                    console.log("\n\uD83D\uDCCA STAKED POSITION (".concat(gaugeInfo.name, "):"));
                    console.log("".concat(stakedBalanceFormatted, " ").concat(bptSymbol, " (staked in gauge) \u2248 $").concat(stakedValueUSD.toFixed(2)));
                    positionResults.staked.balance = (parseFloat(positionResults.staked.balance) + parseFloat(stakedBalanceFormatted)).toString();
                    positionResults.staked.token = positionResults.staked.token ? "".concat(positionResults.staked.token, ", ").concat(bptSymbol) : bptSymbol;
                    positionResults.staked.valueUSD += stakedValueUSD;
                    foundAnyPosition = true;
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 19, , 20]);
                    return [4 /*yield*/, gauge.claimable_tokens(address)];
                case 15:
                    claimableBAL = _a.sent();
                    if (!(claimableBAL > 0n)) return [3 /*break*/, 18];
                    balToken = new ethers_1.ethers.Contract(BAL_TOKEN_ADDRESS, ERC20_ABI, provider);
                    return [4 /*yield*/, balToken.decimals()];
                case 16:
                    balDecimals = _a.sent();
                    balFormatted = formatAmount(claimableBAL, balDecimals);
                    return [4 /*yield*/, getTokenPrice(BAL_TOKEN_ADDRESS, 'BAL')];
                case 17:
                    balPrice = _a.sent();
                    balValueUSD = parseFloat(balFormatted) * balPrice;
                    console.log("\n\uD83C\uDF81 CLAIMABLE REWARDS (".concat(gaugeInfo.name, "):"));
                    console.log("".concat(balFormatted, " BAL (protocol rewards) \u2248 $").concat(balValueUSD.toFixed(4), " @ $").concat(balPrice.toFixed(2), "/BAL"));
                    // Add to total rewards
                    if (positionResults.rewards['BAL']) {
                        positionResults.rewards['BAL'].amount = (parseFloat(positionResults.rewards['BAL'].amount) + parseFloat(balFormatted)).toString();
                        positionResults.rewards['BAL'].valueUSD += balValueUSD;
                    }
                    else {
                        positionResults.rewards['BAL'] = {
                            amount: balFormatted,
                            valueUSD: balValueUSD,
                            price: balPrice
                        };
                    }
                    positionResults.totalRewardsUSD += balValueUSD;
                    _a.label = 18;
                case 18: return [3 /*break*/, 20];
                case 19:
                    error_3 = _a.sent();
                    console.log("Error getting BAL rewards: ".concat(error_3.message));
                    return [3 /*break*/, 20];
                case 20:
                    _a.trys.push([20, 33, , 34]);
                    return [4 /*yield*/, gauge.reward_count()];
                case 21:
                    rewardCount = _a.sent();
                    console.log("\nAdditional Reward Tokens: ".concat(rewardCount));
                    if (!(rewardCount > 0)) return [3 /*break*/, 32];
                    i = 0;
                    _a.label = 22;
                case 22:
                    if (!(i < Number(rewardCount))) return [3 /*break*/, 32];
                    _a.label = 23;
                case 23:
                    _a.trys.push([23, 30, , 31]);
                    return [4 /*yield*/, gauge.reward_tokens(i)];
                case 24:
                    rewardTokenAddress = _a.sent();
                    rewardToken = new ethers_1.ethers.Contract(rewardTokenAddress, ERC20_ABI, provider);
                    return [4 /*yield*/, rewardToken.symbol()];
                case 25:
                    rewardSymbol = _a.sent();
                    return [4 /*yield*/, rewardToken.decimals()];
                case 26:
                    rewardDecimals = _a.sent();
                    return [4 /*yield*/, gauge.claimable_reward(address, rewardTokenAddress)];
                case 27:
                    claimableReward = _a.sent();
                    if (!(claimableReward > 0n)) return [3 /*break*/, 29];
                    rewardFormatted = formatAmount(claimableReward, rewardDecimals);
                    return [4 /*yield*/, getTokenPrice(rewardTokenAddress, rewardSymbol)];
                case 28:
                    tokenPrice = _a.sent();
                    rewardValueUSD = parseFloat(rewardFormatted) * tokenPrice;
                    // Add to total rewards
                    if (positionResults.rewards[rewardSymbol]) {
                        positionResults.rewards[rewardSymbol].amount = (parseFloat(positionResults.rewards[rewardSymbol].amount) + parseFloat(rewardFormatted)).toString();
                        positionResults.rewards[rewardSymbol].valueUSD += rewardValueUSD;
                    }
                    else {
                        positionResults.rewards[rewardSymbol] = {
                            amount: rewardFormatted,
                            valueUSD: rewardValueUSD,
                            price: tokenPrice
                        };
                    }
                    positionResults.totalRewardsUSD += rewardValueUSD;
                    console.log("".concat(rewardFormatted, " ").concat(rewardSymbol, " (").concat(rewardTokenAddress, ") \u2248 $").concat(rewardValueUSD.toFixed(4), " @ $").concat(tokenPrice.toFixed(2), "/").concat(rewardSymbol));
                    _a.label = 29;
                case 29: return [3 /*break*/, 31];
                case 30:
                    error_4 = _a.sent();
                    console.log("Could not read reward token at index ".concat(i, ": ").concat(error_4.message));
                    return [3 /*break*/, 31];
                case 31:
                    i++;
                    return [3 /*break*/, 22];
                case 32: return [3 /*break*/, 34];
                case 33:
                    error_5 = _a.sent();
                    console.log("Gauge doesn't support multiple rewards: ".concat(error_5.message));
                    return [3 /*break*/, 34];
                case 34: return [3 /*break*/, 36];
                case 35:
                    error_6 = _a.sent();
                    console.log("Error checking gauge ".concat(gaugeInfo.name, ": ").concat(error_6.message));
                    return [3 /*break*/, 36];
                case 36:
                    _i++;
                    return [3 /*break*/, 7];
                case 37:
                    if (!foundAnyPosition) {
                        console.log("\n\u274C No positions found for address: ".concat(address));
                    }
                    // 5. Calculate total position value
                    positionResults.totalPositionValueUSD = positionResults.unstaked.valueUSD + positionResults.staked.valueUSD + positionResults.totalRewardsUSD;
                    console.log("\n\uD83D\uDCB0 TOTAL POSITION VALUE:");
                    console.log("Unstaked: $".concat(positionResults.unstaked.valueUSD.toFixed(2)));
                    console.log("Staked: $".concat(positionResults.staked.valueUSD.toFixed(2)));
                    console.log("Rewards: $".concat(positionResults.totalRewardsUSD.toFixed(4)));
                    console.log("TOTAL: $".concat(positionResults.totalPositionValueUSD.toFixed(2)));
                    console.log("\n".concat("=".repeat(60)));
                    return [2 /*return*/, positionResults];
                case 38:
                    error_7 = _a.sent();
                    console.error("\u274C Error reading staking position: ".concat(error_7.message));
                    if (error_7.data) {
                        console.error("Error data: ".concat(error_7.data));
                    }
                    throw error_7;
                case 39: return [2 /*return*/];
            }
        });
    });
}
/**
 * Read positions for multiple addresses
 */
function readMultiplePositions(addresses) {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, addresses_1, address, result, error_8, dataDir, timestamp, resultFile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\n".concat("=".repeat(60)));
                    console.log("\uD83D\uDD0D READING MULTIPLE BALANCER STAKING POSITIONS");
                    console.log("".concat("=".repeat(60), "\n"));
                    results = {};
                    _i = 0, addresses_1 = addresses;
                    _a.label = 1;
                case 1:
                    if (!(_i < addresses_1.length)) return [3 /*break*/, 6];
                    address = addresses_1[_i];
                    console.log("\nReading position for address: ".concat(address));
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, readStakingPosition(address)];
                case 3:
                    result = _a.sent();
                    results[address] = result;
                    return [3 /*break*/, 5];
                case 4:
                    error_8 = _a.sent();
                    console.error("Failed to read position for ".concat(address, ": ").concat(error_8.message));
                    results[address] = { error: error_8.message };
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    dataDir = './data';
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    resultFile = "".concat(dataDir, "/multiple_positions_").concat(timestamp, ".json");
                    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
                    console.log("\nAll positions data saved to ".concat(resultFile));
                    return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Display help message explaining how to use the script
 */
function displayHelp() {
    console.log("\nBalancer Staking Position Reader\n================================\n\nThis script reads your current staking position in Balancer pools and any claimable rewards.\n\nUsage:\n  npx ts-node src/agent/readPositions.ts [options] [address]\n\nOptions:\n  -h, --help                 Display this help message\n  -m, --multiple             Read positions for multiple addresses\n  --use-env                  Use the wallet address from PRIVATE_KEY in .env\n  \nExamples:\n  # Read position for specific address\n  npx ts-node src/agent/readPositions.ts 0xYourAddress\n\n  # Read position using private key in .env\n  npx ts-node src/agent/readPositions.ts --use-env\n\n  # Read positions for multiple addresses\n  npx ts-node src/agent/readPositions.ts --multiple 0xAddress1 0xAddress2 0xAddress3\n\n  # Display help\n  npx ts-node src/agent/readPositions.ts --help\n  ");
}
// Run the function if script is executed directly
if (require.main === module) {
    // Check for command line arguments
    var args = process.argv.slice(2);
    // Show help if requested or no arguments
    if (args.includes('--help') || args.includes('-h')) {
        displayHelp();
        process.exit(0);
    }
    if (args.length === 0 || args.includes('--use-env')) {
        // No arguments provided, use the wallet from PRIVATE_KEY
        readStakingPosition()
            .then(function (result) {
            // Create a data directory if it doesn't exist
            var dataDir = './data';
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            // Save results to a file
            var resultFile = "".concat(dataDir, "/position.json");
            fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
            console.log("Position data saved to ".concat(resultFile));
        })
            .catch(function (error) {
            console.error("Failed to read position: ".concat(error.message));
            process.exit(1);
        });
    }
    else if (args[0] === '--multiple' || args[0] === '-m') {
        // Multiple addresses mode
        var addresses = args.slice(1);
        if (addresses.length === 0) {
            console.error('No addresses provided for multiple mode. Usage: npx ts-node src/agent/readPositions.ts --multiple <address1> <address2> ...');
            process.exit(1);
        }
        readMultiplePositions(addresses)
            .catch(function (error) {
            console.error("Failed to read multiple positions: ".concat(error.message));
            process.exit(1);
        });
    }
    else {
        // Single address provided
        var userAddress = args[0];
        readStakingPosition(userAddress)
            .then(function (result) {
            // Create a data directory if it doesn't exist
            var dataDir = './data';
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            // Save results to a file
            var resultFile = "".concat(dataDir, "/position.json");
            fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
            console.log("Position data saved to ".concat(resultFile));
        })
            .catch(function (error) {
            console.error("Failed to read position: ".concat(error.message));
            process.exit(1);
        });
    }
}
/**
 * Get all staking positions for a specific address
 */
function getPositionsForAddress(address) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, gaugeControllerAddress, gaugeControllerABI, gaugeABI, poolTokenABI, allGauges, positions, _i, allGauges_1, gauge, gaugeContract, balance, symbol, poolToken, error_9, error_10, error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 15, , 16]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
                    gaugeControllerAddress = '0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD';
                    gaugeControllerABI = [
                        'function gauge_types(address gauge) external view returns (int128)'
                    ];
                    gaugeABI = [
                        'function balanceOf(address account) external view returns (uint256)',
                        'function reward_tokens(uint256 index) external view returns (address)',
                        'function claimable_reward(address user, address token) external view returns (uint256)',
                        'function reward_data(address token) external view returns (tuple(address,address,uint256,uint256,uint256,uint256))'
                    ];
                    poolTokenABI = [
                        'function symbol() external view returns (string)'
                    ];
                    console.log("Checking positions for address: ".concat(address));
                    return [4 /*yield*/, getAllGauges()];
                case 1:
                    allGauges = _a.sent();
                    positions = [];
                    _i = 0, allGauges_1 = allGauges;
                    _a.label = 2;
                case 2:
                    if (!(_i < allGauges_1.length)) return [3 /*break*/, 14];
                    gauge = allGauges_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 12, , 13]);
                    gaugeContract = new ethers_1.ethers.Contract(gauge.address, gaugeABI, provider);
                    return [4 /*yield*/, gaugeContract.balanceOf(address)];
                case 4:
                    balance = _a.sent();
                    if (!(balance > 0n)) return [3 /*break*/, 11];
                    symbol = "Unknown";
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 9, , 10]);
                    if (!gauge.poolAddress) return [3 /*break*/, 7];
                    poolToken = new ethers_1.ethers.Contract(gauge.poolAddress, poolTokenABI, provider);
                    return [4 /*yield*/, poolToken.symbol()];
                case 6:
                    symbol = _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    symbol = gauge.name || "Unknown";
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_9 = _a.sent();
                    console.warn("Error getting symbol for gauge ".concat(gauge.address, ": ").concat(error_9));
                    return [3 /*break*/, 10];
                case 10:
                    // Add to positions
                    positions.push({
                        gauge: gauge.address,
                        balance: ethers_1.ethers.formatEther(balance),
                        symbol: symbol,
                        poolAddress: gauge.poolAddress || 'Unknown'
                    });
                    _a.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    error_10 = _a.sent();
                    console.warn("Error checking gauge ".concat(gauge.address, ": ").concat(error_10));
                    return [3 /*break*/, 13];
                case 13:
                    _i++;
                    return [3 /*break*/, 2];
                case 14:
                    console.log("Found ".concat(positions.length, " positions for ").concat(address));
                    return [2 /*return*/, positions];
                case 15:
                    error_11 = _a.sent();
                    console.error('Error getting positions:', error_11);
                    throw error_11;
                case 16: return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper function to get all gauges
 */
function getAllGauges() {
    return __awaiter(this, void 0, void 0, function () {
        var getGauges, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    getGauges = require('../utils/balancerUtils').getGauges;
                    return [4 /*yield*/, getGauges()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_12 = _a.sent();
                    console.error('Failed to load gauges:', error_12);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var url, walletAddress, addressToUse, dataDir, positionFile, positionData_1, positionData, error_13, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    url = new URL(request.url);
                    walletAddress = url.searchParams.get('address');
                    addressToUse = walletAddress || '0x4Aa0B81F700b7053F98eD21e704B25F1A4A52e69';
                    console.log("Fetching position for address: ".concat(addressToUse));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    dataDir = path_1.default.resolve(process.cwd(), 'data');
                    positionFile = path_1.default.join(dataDir, 'position.json');
                    // Check if position.json exists
                    if (fs.existsSync(positionFile)) {
                        console.log("Found cached position data at ".concat(positionFile));
                        positionData_1 = JSON.parse(fs.readFileSync(positionFile, 'utf8'));
                        // Return the cached position data
                        return [2 /*return*/, server_1.NextResponse.json(positionData_1)];
                    }
                    return [4 /*yield*/, readStakingPosition(addressToUse)];
                case 2:
                    positionData = _a.sent();
                    // Make sure data directory exists
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    // Save the position data to position.json
                    fs.writeFileSync(positionFile, JSON.stringify(positionData, null, 2));
                    console.log("Position data saved to ".concat(positionFile));
                    // Return the position data
                    return [2 /*return*/, server_1.NextResponse.json(positionData)];
                case 3:
                    error_13 = _a.sent();
                    console.error('Error fetching position:', error_13);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Failed to fetch position data' }, { status: 500 })];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_14 = _a.sent();
                    console.error('Error in position API route:', error_14);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
