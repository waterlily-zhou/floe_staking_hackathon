import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Status file path (relative to project root, not the ui directory)
const SCHEDULER_STATUS_FILE = path.resolve(process.cwd(), '..', 'data', 'scheduler_logs', 'scheduler_status.json');

// Auto claim settings file path
const AUTO_CLAIM_SETTINGS_FILE = path.resolve(process.cwd(), '..', 'data', 'auto_claim_settings.json');

// Scheduler log file path
const SCHEDULER_LOG_FILE = path.resolve(process.cwd(), '..', 'data', 'scheduler_logs', 'scheduler.log');

// Interface for status response
interface SchedulerStatus {
  isRunning: boolean;
  startedAt: string | null;
  lastCheck: string | null;
  nextScheduledRun: string | null;
  lastUpdated: string | null;
  lastSchedulerLog: string | null;
}

// GET handler - retrieve current scheduler status
export async function GET() {
  try {
    // Default status
    const defaultStatus: SchedulerStatus = {
      isRunning: false,
      startedAt: null,
      lastCheck: null,
      nextScheduledRun: null,
      lastUpdated: null,
      lastSchedulerLog: null
    };
    
    // Read status file if it exists
    if (fs.existsSync(SCHEDULER_STATUS_FILE)) {
      try {
        const data = fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8');
        const statusData = JSON.parse(data);
        
        defaultStatus.isRunning = statusData.isRunning === true;
        defaultStatus.startedAt = statusData.startedAt || null;
        defaultStatus.lastCheck = statusData.lastCheck || null;
        defaultStatus.nextScheduledRun = statusData.nextScheduledRun || null;
        defaultStatus.lastUpdated = statusData.lastUpdated || null;
      } catch (error) {
        console.error('Error parsing scheduler status file:', error);
      }
    }
    
    // Read the last few lines of the log file
    if (fs.existsSync(SCHEDULER_LOG_FILE)) {
      try {
        const logData = fs.readFileSync(SCHEDULER_LOG_FILE, 'utf8');
        const logLines = logData.split('\n').filter(line => line.trim() !== '');
        
        // Get the last line
        if (logLines.length > 0) {
          defaultStatus.lastSchedulerLog = logLines[logLines.length - 1];
        }
      } catch (error) {
        console.error('Error reading scheduler log file:', error);
      }
    }
    
    // Read settings if available
    let settings = null;
    if (fs.existsSync(AUTO_CLAIM_SETTINGS_FILE)) {
      try {
        const settingsData = fs.readFileSync(AUTO_CLAIM_SETTINGS_FILE, 'utf8');
        settings = JSON.parse(settingsData);
      } catch (error) {
        console.error('Error reading auto claim settings:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      status: defaultStatus,
      settings
    });
  } catch (error) {
    console.error('Error retrieving scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve scheduler status' },
      { status: 500 }
    );
  }
} 