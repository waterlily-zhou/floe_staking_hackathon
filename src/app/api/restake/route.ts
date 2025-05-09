import { NextResponse, NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper function to execute a command and get the output
async function executeCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: path.resolve(process.cwd(), '..'), // Run in parent directory where our main code lives
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    childProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Command exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Define a type for the settings
interface AutoClaimSettings {
  minRewards?: number;
  gasAware?: number;
  compoundAware?: number;
  timePeriod?: number;
  useDelegation?: boolean;
  delegationContractAddress?: string;
}

// Update the executeCommand call to handle delegation
async function executeRestakeWithOptions(walletAddress: string, settings: AutoClaimSettings | null) {
  // Build the command arguments
  const args = ['run', 'restake-only', '--'];
  
  // Add wallet address parameter
  if (walletAddress) {
    args.push(`--address=${walletAddress}`);
  }
  
  // Add delegation parameters if enabled
  if (settings?.useDelegation) {
    args.push('--use-delegation');
    
    if (settings.delegationContractAddress) {
      args.push(`--delegation-contract=${settings.delegationContractAddress}`);
    }
  }
  
  // Execute the command with the assembled arguments
  return executeCommand('npm', args);
}

export async function POST(request: NextRequest) {
  try {
    // Parse input data
    const data = await request.json();
    const { walletAddress } = data;
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Get current auto claim settings
    let settings = null;
    try {
      const settingsFilePath = path.resolve(process.cwd(), '..', 'data', 'auto_claim_settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
        settings = JSON.parse(settingsData);
      }
    } catch (error) {
      console.warn('Could not read auto claim settings:', error);
    }
    
    // Execute the restake-only command with the assembled arguments
    await executeRestakeWithOptions(walletAddress, settings);
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Restake initiated for wallet: ' + walletAddress
    });
  } catch (error) {
    console.error('Error initiating restake:', error);
    return NextResponse.json(
      { error: 'Failed to initiate restake process' },
      { status: 500 }
    );
  }
} 