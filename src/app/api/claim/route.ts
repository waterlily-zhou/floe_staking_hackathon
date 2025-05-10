import { NextResponse, NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { executeClaimWithDelegation } from '@agent/delegatedClaiming';

// Helper function to execute a command and get the output
async function executeClaimCommand(walletAddress: string, useDelegation: boolean = false, delegationContractAddress?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build the command arguments
    const args = ['run', 'claim-rewards', '--', `--address=${walletAddress}`];
    
    // Add delegation parameters if needed
    if (useDelegation && delegationContractAddress) {
      args.push('--use-delegation');
      args.push(`--delegation-contract=${delegationContractAddress}`);
    }
    
    const childProcess = spawn('npm', args, {
      cwd: path.resolve(process.cwd()), // Run in project root directory
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
async function executeClaimWithOptions(walletAddress: string, settings: AutoClaimSettings | null) {
  // First, check if we should use delegation approach
  if (settings?.useDelegation && settings.delegationContractAddress) {
    console.log(`Using delegation for claim (contract: ${settings.delegationContractAddress})`);
    
    // Dummy list of gauges and tokens for demonstration
    // In a real implementation, this would come from scanning the user's positions
    const gaugeAddresses = [
      "0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f" // Example gauge
    ];
    
    const rewardTokensPerGauge = [
      ["0xba100000625a3754423978a60c9317c58a424e3D", "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"] // BAL, GHO
    ];
    
    try {
      // Execute the claim via delegation
      await executeClaimWithDelegation(
        walletAddress,
        gaugeAddresses,
        rewardTokensPerGauge,
        settings.delegationContractAddress
      );
      return "Claim executed via delegation contract";
    } catch (error) {
      console.error("Delegation claim failed:", error);
      throw error;
    }
  } else {
    // Use the standard command-line approach
    return executeClaimCommand(walletAddress, settings?.useDelegation, settings?.delegationContractAddress);
  }
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
      const settingsFilePath = path.resolve(process.cwd(), 'data', 'auto_claim_settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
        settings = JSON.parse(settingsData);
      }
    } catch (error) {
      console.warn('Could not read auto claim settings:', error);
    }
    
    // Execute the claim-rewards command with the assembled arguments
    await executeClaimWithOptions(walletAddress, settings);
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Claim initiated for wallet: ' + walletAddress
    });
  } catch (error) {
    console.error('Error initiating claim:', error);
    return NextResponse.json(
      { error: 'Failed to initiate claim process' },
      { status: 500 }
    );
  }
} 