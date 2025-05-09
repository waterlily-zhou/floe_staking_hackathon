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

export async function POST() {
  try {
    console.log('Generating new strategy...');
    
    try {
      // Run the aiAnalysis.ts script directly using ts-node
      await executeCommand('npx', ['ts-node', 'src/agent/aiAnalysis.ts']);
      
      // Read the generated strategy file
      const strategyFilePath = path.resolve(process.cwd(), '..', 'data', 'strategy.json');
      
      if (!fs.existsSync(strategyFilePath)) {
        console.error('Strategy file not found after generation');
        return NextResponse.json(
          { error: 'Strategy generation failed - file not found' },
          { status: 500 }
        );
      }
      
      // Read and parse the strategy data
      const strategyData = JSON.parse(fs.readFileSync(strategyFilePath, 'utf8'));
      
      // Return the strategy data
      return NextResponse.json(strategyData);
    } catch (error) {
      console.error('Error generating strategy:', error);
      return NextResponse.json(
        { error: 'Failed to generate strategy' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in strategy generation API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 