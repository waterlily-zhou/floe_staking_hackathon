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
exports.getGauges = getGauges;
exports.formatAndSumRewards = formatAndSumRewards;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Get all Balancer gauges with their data
 */
async function getGauges() {
    // First try to load from cached file
    const gaugesFilePath = path.join(process.cwd(), 'data', 'gauges.json');
    try {
        if (fs.existsSync(gaugesFilePath)) {
            const gaugesData = JSON.parse(fs.readFileSync(gaugesFilePath, 'utf8'));
            return gaugesData;
        }
    }
    catch (error) {
        console.warn('Error loading gauges from cache:', error);
    }
    // If cache failed or doesn't exist, load from default dataset
    try {
        // Fetch gauge data from Balancer API
        const response = await axios_1.default.get('https://api.balancer.fi/v3/gauges');
        if (response.status === 200 && response.data) {
            const gauges = response.data.data.map((g) => ({
                address: g.address,
                name: g.name || 'Unknown Gauge',
                poolAddress: g.pool?.address || '',
                poolName: g.pool?.name || '',
                totalSupply: g.totalSupply,
                workingSupply: g.workingSupply,
                rewardTokens: g.rewardTokens?.map((t) => ({
                    tokenAddress: t.tokenAddress,
                    symbol: t.symbol || 'Unknown Token',
                    decimals: t.decimals || 18,
                    price: t.price || 0
                })) || []
            }));
            // Save to cache file for future use
            if (!fs.existsSync(path.dirname(gaugesFilePath))) {
                fs.mkdirSync(path.dirname(gaugesFilePath), { recursive: true });
            }
            fs.writeFileSync(gaugesFilePath, JSON.stringify(gauges, null, 2));
            return gauges;
        }
        throw new Error(`Error fetching gauge data: ${response.status}`);
    }
    catch (error) {
        console.error('Failed to fetch gauges from API:', error);
        // Return empty array as fallback
        return [];
    }
}
/**
 * Format reward tokens and sum their USD values
 */
function formatAndSumRewards(rewards) {
    let totalUsdValue = 0;
    const formattedRewards = {};
    // Process each gauge's rewards
    Object.entries(rewards).forEach(([gauge, tokens]) => {
        formattedRewards[gauge] = [];
        // Process each token in this gauge
        Object.entries(tokens).forEach(([token, data]) => {
            formattedRewards[gauge].push({
                token,
                symbol: data.symbol,
                amount: data.amount,
                usdValue: data.usdValue
            });
            totalUsdValue += data.usdValue;
        });
    });
    return { formattedRewards, totalUsdValue };
}
//# sourceMappingURL=balancerUtils.js.map