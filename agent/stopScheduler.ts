import * as fs from 'fs';
import * as path from 'path';

// Status file to track scheduler process
const SCHEDULER_LOG_DIR = path.join(process.cwd(), 'data', 'scheduler_logs');
const SCHEDULER_STATUS_FILE = path.join(SCHEDULER_LOG_DIR, 'scheduler_status.json');

// Ensure directory exists
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Update scheduler status to stopped
function updateStatus(): void {
  ensureDirectoryExists(SCHEDULER_LOG_DIR);
  
  // Create default status if it doesn't exist
  if (!fs.existsSync(SCHEDULER_STATUS_FILE)) {
    const defaultStatus = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
      isRunning: false,
      reason: 'Stopped by user'
    };
    
    fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(defaultStatus, null, 2));
    console.log('Created new scheduler status file with stopped state');
    return;
  }
  
  try {
    // Read current status
    const data = fs.readFileSync(SCHEDULER_STATUS_FILE, 'utf8');
    const status = JSON.parse(data);
    
    // Update status
    status.isRunning = false;
    status.stoppedAt = new Date().toISOString();
    status.lastUpdated = new Date().toISOString();
    status.reason = 'Stopped by user';
    
    // Save updated status
    fs.writeFileSync(SCHEDULER_STATUS_FILE, JSON.stringify(status, null, 2));
    console.log('Updated scheduler status to stopped');
  } catch (error) {
    console.error('Error updating scheduler status:', error);
  }
}

// Stop the scheduler
function stopScheduler(): void {
  console.log('Stopping scheduler...');
  updateStatus();
  console.log('Scheduler stopped. Status updated to not running.');
}

// If this file is run directly, stop the scheduler
if (require.main === module) {
  stopScheduler();
} 