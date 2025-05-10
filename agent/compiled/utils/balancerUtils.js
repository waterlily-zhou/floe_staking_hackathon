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
exports.getGauges = getGauges;
exports.formatAndSumRewards = formatAndSumRewards;
var axios_1 = __importDefault(require("axios"));
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
/**
 * Get all Balancer gauges with their data
 */
function getGauges() {
    return __awaiter(this, void 0, void 0, function () {
        var gaugesFilePath, gaugesData, response, gauges, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    gaugesFilePath = path.join(process.cwd(), 'data', 'gauges.json');
                    try {
                        if (fs.existsSync(gaugesFilePath)) {
                            gaugesData = JSON.parse(fs.readFileSync(gaugesFilePath, 'utf8'));
                            return [2 /*return*/, gaugesData];
                        }
                    }
                    catch (error) {
                        console.warn('Error loading gauges from cache:', error);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get('https://api.balancer.fi/v3/gauges')];
                case 2:
                    response = _a.sent();
                    if (response.status === 200 && response.data) {
                        gauges = response.data.data.map(function (g) {
                            var _a, _b, _c;
                            return ({
                                address: g.address,
                                name: g.name || 'Unknown Gauge',
                                poolAddress: ((_a = g.pool) === null || _a === void 0 ? void 0 : _a.address) || '',
                                poolName: ((_b = g.pool) === null || _b === void 0 ? void 0 : _b.name) || '',
                                totalSupply: g.totalSupply,
                                workingSupply: g.workingSupply,
                                rewardTokens: ((_c = g.rewardTokens) === null || _c === void 0 ? void 0 : _c.map(function (t) { return ({
                                    tokenAddress: t.tokenAddress,
                                    symbol: t.symbol || 'Unknown Token',
                                    decimals: t.decimals || 18,
                                    price: t.price || 0
                                }); })) || []
                            });
                        });
                        // Save to cache file for future use
                        if (!fs.existsSync(path.dirname(gaugesFilePath))) {
                            fs.mkdirSync(path.dirname(gaugesFilePath), { recursive: true });
                        }
                        fs.writeFileSync(gaugesFilePath, JSON.stringify(gauges, null, 2));
                        return [2 /*return*/, gauges];
                    }
                    throw new Error("Error fetching gauge data: ".concat(response.status));
                case 3:
                    error_1 = _a.sent();
                    console.error('Failed to fetch gauges from API:', error_1);
                    // Return empty array as fallback
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Format reward tokens and sum their USD values
 */
function formatAndSumRewards(rewards) {
    var totalUsdValue = 0;
    var formattedRewards = {};
    // Process each gauge's rewards
    Object.entries(rewards).forEach(function (_a) {
        var gauge = _a[0], tokens = _a[1];
        formattedRewards[gauge] = [];
        // Process each token in this gauge
        Object.entries(tokens).forEach(function (_a) {
            var token = _a[0], data = _a[1];
            formattedRewards[gauge].push({
                token: token,
                symbol: data.symbol,
                amount: data.amount,
                usdValue: data.usdValue
            });
            totalUsdValue += data.usdValue;
        });
    });
    return { formattedRewards: formattedRewards, totalUsdValue: totalUsdValue };
}
