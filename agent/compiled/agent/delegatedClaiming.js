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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDelegationStatus = checkDelegationStatus;
exports.shouldClaimForUser = shouldClaimForUser;
exports.executeClaimWithDelegation = executeClaimWithDelegation;
exports.delegateWithMultipleThresholds = delegateWithMultipleThresholds;
exports.processDelegatedClaims = processDelegatedClaims;
var ethers_1 = require("ethers");
var dotenv = __importStar(require("dotenv"));
dotenv.config();
// ABI for the AutoClaimDelegator contract with multiple thresholds
var DELEGATOR_ABI = [
    "function hasDelegatedClaims(address user) view returns (bool)",
    "function userThresholds(address user) view returns (uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, bool initialized)",
    "function delegationExpiry(address user) view returns (uint256)",
    "function shouldClaim(address user, uint256 currentRewardsUsd, uint256 gasPrice, uint256 estimatedGasCost, uint256 estimatedCompoundReturn) view returns (bool)",
    "function shouldClaimSimple(address user, uint256 currentRewardsUsd) view returns (bool)",
    "function getDelegationDetails(address user) view returns (bool hasValidDelegation, uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, uint256 expiry)",
    "function executeClaimOnBehalf(address user, address gaugeAddress, address[] calldata rewardTokens) external",
    "function batchClaimOnBehalf(address user, address[] calldata gaugeAddresses, address[][] calldata rewardTokensPerGauge) external",
    "function delegateClaims(uint256 minRewardsUsd, uint256 gasAwareRatio, uint256 compoundAwareRatio, uint256 durationDays) external",
    "function revokeDelegation() external"
];
/**
 * Check if a user has delegated claim permissions
 * @param userAddress Wallet address to check
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Information about the delegation status
 */
function checkDelegationStatus(userAddress, delegatorContractAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, delegatorContract, _a, hasValidDelegation, minRewardsUsd, gasAwareRatio, compoundAwareRatio, expiryTimestamp, minRewardsValue, gasAwareValue, compoundAwareValue, expiryDate, isExpired, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
                    delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
                    return [4 /*yield*/, delegatorContract.getDelegationDetails(userAddress)];
                case 1:
                    _a = _b.sent(), hasValidDelegation = _a[0], minRewardsUsd = _a[1], gasAwareRatio = _a[2], compoundAwareRatio = _a[3], expiryTimestamp = _a[4];
                    minRewardsValue = parseFloat(ethers_1.ethers.formatUnits(minRewardsUsd, 18));
                    gasAwareValue = parseFloat(ethers_1.ethers.formatUnits(gasAwareRatio, 18));
                    compoundAwareValue = parseFloat(ethers_1.ethers.formatUnits(compoundAwareRatio, 18));
                    expiryDate = expiryTimestamp > 0n ? new Date(Number(expiryTimestamp) * 1000) : null;
                    isExpired = expiryDate ? expiryDate < new Date() : false;
                    return [2 /*return*/, {
                            hasDelegated: hasValidDelegation,
                            minRewardsUsd: minRewardsValue,
                            gasAwareRatio: gasAwareValue,
                            compoundAwareRatio: compoundAwareValue,
                            expiryDate: expiryDate,
                            isExpired: isExpired
                        }];
                case 2:
                    error_1 = _b.sent();
                    console.error("Error checking delegation status: ".concat(error_1));
                    // Return default values indicating no delegation
                    return [2 /*return*/, {
                            hasDelegated: false,
                            minRewardsUsd: 0,
                            gasAwareRatio: 0,
                            compoundAwareRatio: 0,
                            expiryDate: null,
                            isExpired: true
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if a user has met any of their claim thresholds
 * @param userAddress Wallet address to check
 * @param currentRewardsUsd Current rewards value in USD
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @param gasPriceGwei Current gas price in gwei
 * @param estimatedGasCostGwei Estimated gas cost in gwei
 * @param estimatedCompoundReturnUsd Estimated compound return in USD
 * @returns Whether claiming should proceed
 */
function shouldClaimForUser(userAddress_1, currentRewardsUsd_1, delegatorContractAddress_1) {
    return __awaiter(this, arguments, void 0, function (userAddress, currentRewardsUsd, delegatorContractAddress, gasPriceGwei, // Default to 50 gwei if not provided
    estimatedGasCostGwei, // Default estimate if not provided
    estimatedCompoundReturnUsd // Default to 0 if not provided
    ) {
        var provider, delegatorContract, rewardsWei, gasPriceWei, estimatedGasCostWei, estimatedCompoundReturnWei, error_2, provider, delegatorContract, rewardsWei, fallbackError_1;
        if (gasPriceGwei === void 0) { gasPriceGwei = 50; }
        if (estimatedGasCostGwei === void 0) { estimatedGasCostGwei = 300000; }
        if (estimatedCompoundReturnUsd === void 0) { estimatedCompoundReturnUsd = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 7]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
                    delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
                    rewardsWei = ethers_1.ethers.parseUnits(currentRewardsUsd.toString(), 18);
                    gasPriceWei = ethers_1.ethers.parseUnits(gasPriceGwei.toString(), 9);
                    estimatedGasCostWei = BigInt(estimatedGasCostGwei);
                    estimatedCompoundReturnWei = ethers_1.ethers.parseUnits(estimatedCompoundReturnUsd.toString(), 18);
                    return [4 /*yield*/, delegatorContract.shouldClaim(userAddress, rewardsWei, gasPriceWei, estimatedGasCostWei, estimatedCompoundReturnWei)];
                case 1: 
                // Check if should claim using the enhanced function
                return [2 /*return*/, _a.sent()];
                case 2:
                    error_2 = _a.sent();
                    console.error("Error checking if should claim: ".concat(error_2));
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
                    delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, provider);
                    rewardsWei = ethers_1.ethers.parseUnits(currentRewardsUsd.toString(), 18);
                    return [4 /*yield*/, delegatorContract.shouldClaimSimple(userAddress, rewardsWei)];
                case 4: return [2 /*return*/, _a.sent()];
                case 5:
                    fallbackError_1 = _a.sent();
                    console.error("Fallback check also failed: ".concat(fallbackError_1));
                    return [2 /*return*/, false];
                case 6: return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Execute claim on behalf of a user using the delegation contract
 * @param userAddress User's wallet address
 * @param gaugeAddresses Array of gauge contract addresses
 * @param rewardTokensPerGauge Array of arrays containing reward tokens for each gauge
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Transaction hash if successful
 */
function executeClaimWithDelegation(userAddress, gaugeAddresses, rewardTokensPerGauge, delegatorContractAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, adminWallet, delegatorContract, tx, receipt, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    // Check for private key
                    if (!process.env.ADMIN_PRIVATE_KEY) {
                        throw new Error("ADMIN_PRIVATE_KEY environment variable is required for executing delegated claims");
                    }
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
                    adminWallet = new ethers_1.ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
                    delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, adminWallet);
                    return [4 /*yield*/, delegatorContract.batchClaimOnBehalf(userAddress, gaugeAddresses, rewardTokensPerGauge)];
                case 1:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 2:
                    receipt = _a.sent();
                    console.log("Delegated claim executed for ".concat(userAddress, ". Transaction hash: ").concat(receipt.hash));
                    return [2 /*return*/, receipt.hash];
                case 3:
                    error_3 = _a.sent();
                    console.error("Error executing delegated claim: ".concat(error_3));
                    throw error_3;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Delegate claim permissions with multiple thresholds
 * @param userAddress User's wallet address
 * @param minRewardsUsd Minimum rewards in USD to trigger claim
 * @param gasAwareRatio Gas-aware threshold (rewards/gas ratio)
 * @param compoundAwareRatio Compound-aware threshold
 * @param durationDays Duration in days
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 * @returns Transaction hash if successful
 */
function delegateWithMultipleThresholds(userAddress, minRewardsUsd, gasAwareRatio, compoundAwareRatio, durationDays, delegatorContractAddress, privateKey) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, wallet, walletAddress, delegatorContract, minRewardsWei, gasAwareRatioWei, compoundAwareRatioWei, tx, receipt, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    provider = new ethers_1.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
                    wallet = new ethers_1.ethers.Wallet(privateKey, provider);
                    return [4 /*yield*/, wallet.getAddress()];
                case 1:
                    walletAddress = _a.sent();
                    if (walletAddress.toLowerCase() !== userAddress.toLowerCase()) {
                        throw new Error("Wallet address does not match the provided user address");
                    }
                    delegatorContract = new ethers_1.ethers.Contract(delegatorContractAddress, DELEGATOR_ABI, wallet);
                    minRewardsWei = ethers_1.ethers.parseUnits(minRewardsUsd.toString(), 18);
                    gasAwareRatioWei = ethers_1.ethers.parseUnits(gasAwareRatio.toString(), 18);
                    compoundAwareRatioWei = ethers_1.ethers.parseUnits(compoundAwareRatio.toString(), 18);
                    return [4 /*yield*/, delegatorContract.delegateClaims(minRewardsWei, gasAwareRatioWei, compoundAwareRatioWei, durationDays)];
                case 2:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 3:
                    receipt = _a.sent();
                    console.log("Delegation created for ".concat(userAddress, ". Transaction hash: ").concat(receipt.hash));
                    return [2 /*return*/, receipt.hash];
                case 4:
                    error_4 = _a.sent();
                    console.error("Error creating delegation: ".concat(error_4));
                    throw error_4;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check all user delegations and process claims if thresholds are met
 * @param delegatorContractAddress Address of the deployed AutoClaimDelegator contract
 */
function processDelegatedClaims(delegatorContractAddress) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // This would be called by a scheduled task
            // Implementation would be similar to original with enhanced functions
            console.log("Processing delegated claims (placeholder for implementation)");
            return [2 /*return*/];
        });
    });
}
