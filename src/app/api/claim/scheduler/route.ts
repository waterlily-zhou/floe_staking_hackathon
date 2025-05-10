// src/app/api/claim/scheduler/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Define paths
const SCHEDULER_LOG_DIR = path.resolve(process.cwd(), 'data', 'scheduler_logs');
const SCHEDULER_STATUS_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler_status.json');
const SCHEDULER_LOG_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler.log');

// Ensure directory exists
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function logToScheduler(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Ensure log directory exists
  ensureDirectoryExists(SCHEDULER_LOG_DIR);
  
  // Append to log file
  fs.appendFileSync(SCHEDULER_LOG_FILE, logMessage);
  console.log(`[Scheduler] ${message}`);
}

// Function to start the scheduler process
async function startSchedulerProcess(walletAddress?: string): Promise<boolean> {
  try {
    console.log(`Starting scheduler process with wallet: ${walletAddress || 'none'}`);
    
    ensureDirectoryExists(SCHEDULER_LOG_DIR);
    
    // Kill any existing processes
    try {
      logToScheduler("Attempting to clean up any existing scheduler processes...");
      const killProcess = spawn('pkill', ['-f', 'autoClaimScheduler']);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
    } catch (error) {
      // Ignore errors here, it's just cleanup
    }

    // Use the compiled JavaScript file but override module type to CommonJS
    const args = [
      'agent/compiled/agent/autoClaimScheduler.js'
    ];
    
    // Add additional arguments
    if (walletAddress) {
      args.push(`--address=${walletAddress}`);
    }
    
    args.push('--run-now');
    
    // Log the command
    const cmdString = `node ${args.join(' ')}`;
    logToScheduler(`Starting scheduler with command: ${cmdString}`);
    
    // Spawn as detached process using node directly
    const schedulerProcess = spawn('node', args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], 
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    let stdout = '';
    let stderr = '';

    schedulerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log important parts of the output
      if (output.includes('AUTO CLAIM SCHEDULER STARTED')) {
        logToScheduler('Detected scheduler startup message: AUTO CLAIM SCHEDULER STARTED');
      }
    });
    
    schedulerProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logToScheduler(`Scheduler error: ${data.toString()}`);
    });

    // Wait a bit to check for immediate errors
    const success = await new Promise<boolean>(resolve => {
      const timeout = setTimeout(() => {
        // No early exit, resolve and consider it started
        if (schedulerProcess.pid) {
          logToScheduler(`Scheduler process started successfully with PID: ${schedulerProcess.pid}`);
        }
        resolve(true);
      }, 2000);
      
      // Listen for immediate errors
      schedulerProcess.on('error', (err) => {
        clearTimeout(timeout);
        logToScheduler(`Failed to start scheduler: ${err.message}`);
        resolve(false);
      });
      
      schedulerProcess.on('exit', (code, signal) => {
        if (code !== null) {
          clearTimeout(timeout);
          logToScheduler(`Scheduler process exited with code ${code}`);
          resolve(false);
        }
      });
    });

    // Unref the child process so parent can exit independently
    schedulerProcess.unref();
    
    // Write initial status
    const initialStatus = {
      isRunning: true,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      nextScheduledRun: null,
      lastCheck: null,
      configuration: {
        cronExpression: '0 */4 * * *',
        walletAddress: walletAddress || undefined,
        useSubprocess: true,
        runImmediately: true
      }
    };
    
    fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(initialStatus, null, 2));
    logToScheduler('Updated scheduler status file to running');
    
    return success;
  } catch (error) {
    logToScheduler(`Error starting scheduler: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Check if scheduler process is running
function isSchedulerRunning(): boolean {
  try {
    if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
      const status = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
      // Only consider it running if updated in the last 15 minutes
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
      
      if (status.isRunning && new Date(status.lastUpdated) > fifteenMinutesAgo) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking scheduler status:', error);
    return false;
  }
}

// Improved stopScheduler function
async function stopScheduler(): Promise<boolean> {
  try {
    logToScheduler('Stopping scheduler via API');
    
    // Try to kill the process with proper waiting and error handling
    try {
      // Execute the pkill command and wait for it to complete
      const killProcess = spawn('pkill', ['-f', 'autoClaimScheduler']);
      
      // Wait for the process to complete
      await new Promise<void>((resolve, reject) => {
        killProcess.on('close', (code) => {
          if (code !== 0 && code !== 1) {
            // code 1 is acceptable - it means no processes were found to kill
            logToScheduler(`pkill exited with code ${code}`);
          }
          resolve();
        });
        
        killProcess.on('error', (err) => {
          logToScheduler(`Error executing pkill: ${err.message}`);
          resolve(); // Continue anyway
        });
      });
      
      // Give a short delay to ensure processes are terminated
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      logToScheduler(`Error trying to kill scheduler process: ${error instanceof Error ? error.message : String(error)}`);
      // Continue execution to update the status file
    }
    
    // Update status file
    if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
      const status = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
      status.isRunning = false;
      status.stoppedAt = new Date().toISOString();
      status.lastUpdated = new Date().toISOString();
      status.reason = 'Stopped via API';
      
      fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(status, null, 2));
      logToScheduler('Updated scheduler status file to stopped');
      
      return true;
    } else {
      // Create a new status file if one doesn't exist
      const defaultStatus = {
        isRunning: false,
        startedAt: new Date().toISOString(),
        stoppedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        reason: 'Stopped via API'
      };
      
      // Ensure directory exists
      ensureDirectoryExists(SCHEDULER_LOG_DIR);
      
      fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(defaultStatus, null, 2));
      logToScheduler('Created new scheduler status file with stopped state');
      
      return true;
    }
  } catch (error) {
    logToScheduler(`Error stopping scheduler: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// POST handler - start or stop the scheduler
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const data = await request.json();
    const { action, walletAddress } = data;
    
    if (action === 'start') {
      // Check if already running
      if (isSchedulerRunning()) {
        // Force restart if already running
        logToScheduler('Force restarting scheduler since it was already running');
        stopScheduler();
      }
      
      // Start the scheduler
      const success = await startSchedulerProcess(walletAddress);
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Scheduler started successfully',
          status: { isRunning: true }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Failed to start scheduler',
          status: { isRunning: false }
        }, { status: 500 });
      }
    } 
    else if (action === 'stop') {
      // Stop the scheduler
      const success = await stopScheduler();
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Scheduler stopped successfully',
          status: { isRunning: false }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Failed to stop scheduler or scheduler was not running',
          status: { isRunning: false }
        });
      }
    }
    else if (action === 'status') {
      // Check scheduler status
      const isRunning = isSchedulerRunning();
      
      let status = { isRunning: false };
      if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
        try {
          status = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
        } catch (error) {
          console.error('Error reading scheduler status file:', error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: isRunning ? 'Scheduler is running' : 'Scheduler is not running',
        status
      });
    }
    else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start", "stop", or "status".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error managing scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to manage scheduler' },
      { status: 500 }
    );
  }
}

// GET handler - get current scheduler status
export async function GET() {
  try {
    // Check scheduler status
    const isRunning = isSchedulerRunning();
    
    let status = { isRunning: false };
    if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
      try {
        status = JSON.parse(fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8'));
      } catch (error) {
        console.error('Error reading scheduler status file:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: isRunning ? 'Scheduler is running' : 'Scheduler is not running',
      status
    });
  } catch (error) {
    console.error('Error retrieving scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve scheduler status' },
      { status: 500 }
    );
  }
}