import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { spawn } from 'child_process';
import { checkRewardsThresholds } from './autoClaimChecker';

// Directory for scheduler logs
const SCHEDULER_LOG_DIR = path.join(process.cwd(), 'data', 'scheduler_logs');

// Path to the scheduler log file
const SCHEDULER_LOG_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler.log');

// Status file to track scheduler process
const SCHEDULER_STATUS_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler_status.json');

// Ensure directory exists
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Log message to file and console
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  // Ensure log directory exists
  ensureDirectoryExists(SCHEDULER_LOG_DIR);
  
  // Append to log file
  fs.appendFileSync(SCHEDULER_LOG_FILE, logMessage);
}

// Type for scheduler status
interface SchedulerStatus {
  startedAt: string;
  lastUpdated: string;
  stoppedAt?: string;
  isRunning: boolean;
  lastCheck?: string | null;
  nextScheduledRun?: string | null;
  configuration: SchedulerConfig;
  reason?: string;
}

// Save scheduler status
function saveStatus(status: Partial<SchedulerStatus>): void {
  ensureDirectoryExists(SCHEDULER_LOG_DIR);
  
  // Read existing status if available
  let currentStatus: SchedulerStatus;
  try {
    if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
      currentStatus = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
    } else {
      currentStatus = {
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isRunning: true,
        configuration: DEFAULT_CONFIG
      };
    }
  } catch (error) {
    // If error reading file, create a new status
    currentStatus = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isRunning: true,
      configuration: DEFAULT_CONFIG
    };
  }
  
  // Update with new status
  const updatedStatus = {
    ...currentStatus,
    ...status,
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(updatedStatus, null, 2));
}

// Run a command and return its output
async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run the checker directly
async function runChecker(): Promise<void> {
  log('Starting auto claim check...');
  
  try {
    await checkRewardsThresholds();
    log('Auto claim check completed successfully');
  } catch (error: any) {
    log(`Error during auto claim check: ${error.message || String(error)}`);
  }
}

// Run the checker as a separate process
async function runCheckerAsProcess(walletAddress?: string): Promise<void> {
  log('Starting auto claim check as separate process...');
  
  try {
    // Build command arguments
    const args = ['ts-node', 'src/agent/autoClaimChecker.ts'];
    
    // Add wallet address if provided
    if (walletAddress) {
      args.push(`--address=${walletAddress}`);
      log(`Using wallet address: ${walletAddress}`);
    }
    
    const result = await runCommand('npx', args);
    log('Auto claim check completed successfully');
    log(`Process output: ${result.substring(0, 500)}${result.length > 500 ? '...' : ''}`);
  } catch (error: any) {
    log(`Error running auto claim check: ${error.message || String(error)}`);
  }
}

// Configuration for the scheduler
interface SchedulerConfig {
  // Cron expression for when to run the checker (default: every 4 hours)
  cronExpression: string;
  
  // Whether to run the checker in the same process or spawn a new one
  useSubprocess: boolean;
  
  // Whether to run the checker immediately on startup
  runImmediately: boolean;
  
  // Wallet address to use for checks
  walletAddress?: string;
}

// Default configuration
const DEFAULT_CONFIG: SchedulerConfig = {
  cronExpression: '0 */4 * * *', // Every 4 hours
  useSubprocess: true,
  runImmediately: false,
  walletAddress: undefined
};

// Load configuration from command line arguments
function loadConfig(): SchedulerConfig {
  const config = { ...DEFAULT_CONFIG };
  
  const args = process.argv.slice(2);
  
  // Override with command line arguments
  args.forEach(arg => {
    if (arg === '--run-now') {
      config.runImmediately = true;
    } else if (arg.startsWith('--cron=')) {
      config.cronExpression = arg.substring('--cron='.length);
    } else if (arg === '--same-process') {
      config.useSubprocess = false;
    } else if (arg.startsWith('--address=')) {
      config.walletAddress = arg.substring('--address='.length);
    }
  });
  
  return config;
}

// Main function to start the scheduler
async function startScheduler(): Promise<void> {
  // Load configuration
  const config = loadConfig();
  
  // Ensure log directory exists
  ensureDirectoryExists(SCHEDULER_LOG_DIR);
  
  // Save initial status
  const status: Partial<SchedulerStatus> = {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    configuration: config,
    lastCheck: null,
    isRunning: true
  };
  
  saveStatus(status);
  
  log('🤖 AUTO-COMPOUND AI: AUTO CLAIM SCHEDULER STARTED');
  log('---------------------------------------------');
  log(`Schedule: ${config.cronExpression} (runs according to cron expression)`);
  log(`Human-readable schedule: ${cronToReadable(config.cronExpression)}`);
  log(`Process mode: ${config.useSubprocess ? 'Subprocess' : 'Same process'}`);
  log(`Run immediately: ${config.runImmediately ? 'Yes' : 'No'}`);
  if (config.walletAddress) {
    log(`Wallet address: ${config.walletAddress}`);
  } else {
    log('Warning: No wallet address specified. Checks may not work correctly.');
  }
  log('---------------------------------------------');
  
  // Run immediately if configured to do so
  if (config.runImmediately) {
    log('Running immediate check as configured...');
    
    if (config.useSubprocess) {
      await runCheckerAsProcess(config.walletAddress);
    } else {
      await checkRewardsThresholds();
    }
    
    // Update status
    status.lastCheck = new Date().toISOString();
    saveStatus(status);
  }
  
  // Set up the cron job
  cron.schedule(config.cronExpression, async () => {
    log(`Scheduled check triggered at ${new Date().toISOString()}`);
    
    if (config.useSubprocess) {
      await runCheckerAsProcess(config.walletAddress);
    } else {
      await checkRewardsThresholds();
    }
    
    // Update status
    status.lastCheck = new Date().toISOString();
    
    // Calculate next run time
    const nextRun = getNextCronRunDate(config.cronExpression);
    
    saveStatus({
      lastCheck: new Date().toISOString(),
      nextScheduledRun: nextRun?.toISOString() || null
    });
  });
  
  // Calculate initial next run time
  const nextRun = getNextCronRunDate(config.cronExpression);
  if (nextRun) {
    status.nextScheduledRun = nextRun.toISOString();
    saveStatus({ nextScheduledRun: nextRun.toISOString() });
  }
  
  log(`Scheduler running. Waiting for scheduled times (${config.cronExpression})...`);
  log('Process will continue running in the background. Use Ctrl+C to stop.');
}

// Convert cron expression to human-readable form (simplified version)
function cronToReadable(cronExpression: string): string {
  const parts = cronExpression.split(' ');
  
  if (parts.length !== 5) {
    return 'Custom schedule';
  }
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
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
function getNextCronRunDate(cronExpression: string): Date | null {
  try {
    // Use the cronParser library from node-cron to find next execution date
    const parser = require('node-cron/src/parser');
    const schedule = parser.parseExpression(cronExpression);
    
    // Get current date
    const now = new Date();
    
    // Find the next schedule after now
    // This is a simplified implementation to find the next run date
    let nextDate = new Date(now);
    
    // Parse cron parts
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      return null; // Invalid cron expression
    }
    
    // For simple interval patterns
    if (parts[1].includes('*/')) {
      // For hourly intervals like */4
      const hourInterval = parseInt(parts[1].replace('*/', ''));
      if (!isNaN(hourInterval) && hourInterval > 0) {
        const currentHour = now.getHours();
        const nextHour = currentHour + (hourInterval - (currentHour % hourInterval));
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
      const hour = parseInt(parts[1]);
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
  } catch (error) {
    console.error('Error calculating next run date:', error);
    // Fallback: return tomorrow same time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('Scheduler stopping due to SIGINT signal');
  
  // Update status
  const status: Partial<SchedulerStatus> = {
    stoppedAt: new Date().toISOString(),
    isRunning: false,
    reason: 'SIGINT signal received'
  };
  
  saveStatus(status);
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Scheduler stopping due to SIGTERM signal');
  
  // Update status
  const status: Partial<SchedulerStatus> = {
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
    .catch(error => {
      log(`Error starting scheduler: ${error.message || String(error)}`);
      process.exit(1);
    });
} 