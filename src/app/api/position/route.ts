import { NextResponse } from 'next/server';
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
        console.error(stderr);
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}


// Helper to get the most recent file in a directory
function getMostRecentFile(dir: string, subdir?: string): string | null {
  try {
    const baseDir = subdir 
      ? path.resolve(process.cwd(), '..', dir, subdir)
      : path.resolve(process.cwd(), '..', dir);
      
    if (!fs.existsSync(baseDir)) {
      console.error(`Directory ${baseDir} does not exist`);
      return null;
    }
    
    const files = fs.readdirSync(baseDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(baseDir, file),
        mtime: fs.statSync(path.join(baseDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    return files.length > 0 ? files[0].path : null;
  } catch (error) {
    console.error('Error getting most recent file:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // Get wallet address from the query parameter
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('address');
    
    // Use default address if not provided
    const addressToUse = walletAddress || '0x4Aa0B81F700b7053F98eD21e704B25F1A4A52e69';
    
    console.log(`Fetching position for address: ${addressToUse}`);
    
    try {
      // Execute the read-position command with the specified address
      await executeCommand('npm', ['run', 'read-position', addressToUse]);
      
      // After executing the command, look for the created file
      const positionFile = getMostRecentFile('data', 'positions_logs');
      
      // If we still don't have position data, return an error
      if (!positionFile) {
        console.error('Could not find position data file after fetch attempt');
        return NextResponse.json(
          { error: 'Position data not found' },
          { status: 404 }
        );
      }
      
      // Read and parse the position data
      const positionData = JSON.parse(fs.readFileSync(positionFile, 'utf8'));
      
      // Return the position data
      return NextResponse.json(positionData);
    } catch (error) {
      console.error('Error fetching position:', error);
      return NextResponse.json(
        { error: 'Failed to fetch position data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in position API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 