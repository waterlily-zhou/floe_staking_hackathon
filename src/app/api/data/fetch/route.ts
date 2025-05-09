import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

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

export async function POST() {
  try {
    console.log('Fetching new gauge and pool data...');

    try {
      // Run the fetchGaugeData.ts script to get latest data
      await executeCommand('npx', ['ts-node', 'src/agent/fetchGaugeData.ts']);
      
      console.log('Data fetch completed successfully');
      
      return NextResponse.json({
        success: true,
        message: 'Successfully fetched and updated gauge and pool data'
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data: ' + (error instanceof Error ? error.message : String(error)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in data fetch API route:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 