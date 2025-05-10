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
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var cron = __importStar(require("node-cron"));
var child_process_1 = require("child_process");
var autoClaimChecker_1 = require("./autoClaimChecker.js");
// Directory for scheduler logs
var SCHEDULER_LOG_DIR = path.join(process.cwd(), 'data', 'scheduler_logs');
// Path to the scheduler log file
var SCHEDULER_LOG_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler.log');
// Status file to track scheduler process
var SCHEDULER_STATUS_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler_status.json');
// Ensure directory exists
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
// Log message to file and console
function log(message) {
    var timestamp = new Date().toISOString();
    var logMessage = "[".concat(timestamp, "] ").concat(message, "\n");
    console.log(message);
    // Ensure log directory exists
    ensureDirectoryExists(SCHEDULER_LOG_DIR);
    // Append to log file
    fs.appendFileSync(SCHEDULER_LOG_FILE, logMessage);
}
// Save scheduler status
function saveStatus(status) {
    ensureDirectoryExists(SCHEDULER_LOG_DIR);
    // Read existing status if available
    var currentStatus;
    try {
        if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
            currentStatus = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
        }
        else {
            currentStatus = {
                startedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                isRunning: true,
                configuration: DEFAULT_CONFIG
            };
        }
    }
    catch (error) {
        // If error reading file, create a new status
        currentStatus = {
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isRunning: true,
            configuration: DEFAULT_CONFIG
        };
    }
    // Update with new status
    var updatedStatus = __assign(__assign(__assign({}, currentStatus), status), { lastUpdated: new Date().toISOString() });
    fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(updatedStatus, null, 2));
}
// Run a command and return its output
function runCommand(command, args) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var process = (0, child_process_1.spawn)(command, args);
                    var stdout = '';
                    var stderr = '';
                    process.stdout.on('data', function (data) {
                        stdout += data.toString();
                    });
                    process.stderr.on('data', function (data) {
                        stderr += data.toString();
                    });
                    process.on('close', function (code) {
                        if (code !== 0) {
                            reject(new Error("Command failed with code ".concat(code, ": ").concat(stderr)));
                        }
                        else {
                            resolve(stdout);
                        }
                    });
                })];
        });
    });
}
// Run the checker directly
function runChecker() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Starting auto claim check...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, autoClaimChecker_1.checkRewardsThresholds)()];
                case 2:
                    _a.sent();
                    log('Auto claim check completed successfully');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    log("Error during auto claim check: ".concat(error_1.message || String(error_1)));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Run the checker as a separate process
function runCheckerAsProcess(walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var args, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Starting auto claim check as separate process...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    args = ['node', 'agent/compiled/agent/autoClaimChecker.js'];
                    // Add wallet address if provided
                    if (walletAddress) {
                        args.push("--address=".concat(walletAddress));
                        log("Using wallet address: ".concat(walletAddress));
                    }
                    return [4 /*yield*/, runCommand('npx', args)];
                case 2:
                    result = _a.sent();
                    log('Auto claim check completed successfully');
                    log("Process output: ".concat(result.substring(0, 500)).concat(result.length > 500 ? '...' : ''));
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    log("Error running auto claim check: ".concat(error_2.message || String(error_2)));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Default configuration
var DEFAULT_CONFIG = {
    cronExpression: '0 */4 * * *', // Every 4 hours
    useSubprocess: true,
    runImmediately: false,
    walletAddress: undefined
};
// Load configuration from command line arguments
function loadConfig() {
    var config = __assign({}, DEFAULT_CONFIG);
    var args = process.argv.slice(2);
    // Override with command line arguments
    args.forEach(function (arg) {
        if (arg === '--run-now') {
            config.runImmediately = true;
        }
        else if (arg.startsWith('--cron=')) {
            config.cronExpression = arg.substring('--cron='.length);
        }
        else if (arg === '--same-process') {
            config.useSubprocess = false;
        }
        else if (arg.startsWith('--address=')) {
            config.walletAddress = arg.substring('--address='.length);
        }
    });
    return config;
}
// Main function to start the scheduler
function startScheduler() {
    return __awaiter(this, void 0, void 0, function () {
        var config, status, nextRun;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = loadConfig();
                    // Ensure log directory exists
                    ensureDirectoryExists(SCHEDULER_LOG_DIR);
                    status = {
                        startedAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        configuration: config,
                        lastCheck: null,
                        isRunning: true
                    };
                    saveStatus(status);
                    log('🤖 AUTO-COMPOUND AI: AUTO CLAIM SCHEDULER STARTED');
                    log('---------------------------------------------');
                    log("Schedule: ".concat(config.cronExpression, " (runs according to cron expression)"));
                    log("Human-readable schedule: ".concat(cronToReadable(config.cronExpression)));
                    log("Process mode: ".concat(config.useSubprocess ? 'Subprocess' : 'Same process'));
                    log("Run immediately: ".concat(config.runImmediately ? 'Yes' : 'No'));
                    if (config.walletAddress) {
                        log("Wallet address: ".concat(config.walletAddress));
                    }
                    else {
                        log('Warning: No wallet address specified. Checks may not work correctly.');
                    }
                    log('---------------------------------------------');
                    if (!config.runImmediately) return [3 /*break*/, 5];
                    log('Running immediate check as configured...');
                    if (!config.useSubprocess) return [3 /*break*/, 2];
                    return [4 /*yield*/, runCheckerAsProcess(config.walletAddress)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, (0, autoClaimChecker_1.checkRewardsThresholds)()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    // Update status
                    status.lastCheck = new Date().toISOString();
                    saveStatus(status);
                    _a.label = 5;
                case 5:
                    // Set up the cron job
                    cron.schedule(config.cronExpression, function () { return __awaiter(_this, void 0, void 0, function () {
                        var nextRun;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    log("Scheduled check triggered at ".concat(new Date().toISOString()));
                                    if (!config.useSubprocess) return [3 /*break*/, 2];
                                    return [4 /*yield*/, runCheckerAsProcess(config.walletAddress)];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, (0, autoClaimChecker_1.checkRewardsThresholds)()];
                                case 3:
                                    _a.sent();
                                    _a.label = 4;
                                case 4:
                                    // Update status
                                    status.lastCheck = new Date().toISOString();
                                    nextRun = getNextCronRunDate(config.cronExpression);
                                    saveStatus({
                                        lastCheck: new Date().toISOString(),
                                        nextScheduledRun: (nextRun === null || nextRun === void 0 ? void 0 : nextRun.toISOString()) || null
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    nextRun = getNextCronRunDate(config.cronExpression);
                    if (nextRun) {
                        status.nextScheduledRun = nextRun.toISOString();
                        saveStatus({ nextScheduledRun: nextRun.toISOString() });
                    }
                    log("Scheduler running. Waiting for scheduled times (".concat(config.cronExpression, ")..."));
                    log('Process will continue running in the background. Use Ctrl+C to stop.');
                    return [2 /*return*/];
            }
        });
    });
}
// Convert cron expression to human-readable form (simplified version)
function cronToReadable(cronExpression) {
    var parts = cronExpression.split(' ');
    if (parts.length !== 5) {
        return 'Custom schedule';
    }
    var minute = parts[0], hour = parts[1], dayOfMonth = parts[2], month = parts[3], dayOfWeek = parts[4];
    // Handle common patterns
    if (minute === '0' && hour === '*/4' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Every 4 hours';
    }
    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Daily at midnight';
    }
    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '1') {
        return 'Every Monday at midnight';
    }
    // Default
    return 'Custom schedule';
}
// Calculate the next run date for a cron expression
function getNextCronRunDate(cronExpression) {
    try {
        // Use the cronParser library from node-cron to find next execution date
        var parser = require('node-cron/src/parser');
        var schedule = parser.parseExpression(cronExpression);
        // Get current date
        var now = new Date();
        // Find the next schedule after now
        // This is a simplified implementation to find the next run date
        var nextDate = new Date(now);
        // Parse cron parts
        var parts = cronExpression.split(' ');
        if (parts.length !== 5) {
            return null; // Invalid cron expression
        }
        // For simple interval patterns
        if (parts[1].includes('*/')) {
            // For hourly intervals like */4
            var hourInterval = parseInt(parts[1].replace('*/', ''));
            if (!isNaN(hourInterval) && hourInterval > 0) {
                var currentHour = now.getHours();
                var nextHour = currentHour + (hourInterval - (currentHour % hourInterval));
                nextDate.setHours(nextHour % 24, 0, 0, 0);
                if (nextDate <= now) {
                    nextDate.setDate(nextDate.getDate() + 1);
                }
                return nextDate;
            }
        }
        // For simple daily pattern
        if (parts[1] === '0' && parts[2] === '*') {
            // Daily at specific hour
            var hour = parseInt(parts[1]);
            if (!isNaN(hour)) {
                nextDate.setHours(hour, 0, 0, 0);
                if (nextDate <= now) {
                    nextDate.setDate(nextDate.getDate() + 1);
                }
                return nextDate;
            }
        }
        // Default fallback: add 24 hours to current time
        nextDate.setTime(now.getTime() + 24 * 60 * 60 * 1000);
        return nextDate;
    }
    catch (error) {
        console.error('Error calculating next run date:', error);
        // Fallback: return tomorrow same time
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }
}
// Handle process signals
process.on('SIGINT', function () {
    log('Scheduler stopping due to SIGINT signal');
    // Update status
    var status = {
        stoppedAt: new Date().toISOString(),
        isRunning: false,
        reason: 'SIGINT signal received'
    };
    saveStatus(status);
    process.exit(0);
});
process.on('SIGTERM', function () {
    log('Scheduler stopping due to SIGTERM signal');
    // Update status
    var status = {
        stoppedAt: new Date().toISOString(),
        isRunning: false,
        reason: 'SIGTERM signal received'
    };
    saveStatus(status);
    process.exit(0);
});
// If this file is run directly, start the scheduler
if (require.main === module) {
    startScheduler()
        .catch(function (error) {
        log("Error starting scheduler: ".concat(error.message || String(error)));
        process.exit(1);
    });
}
