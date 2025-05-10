import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper function to execute a command and get the output
async function executeCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: path.resolve(process.cwd()),
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

export async function GET() {
  try {
    const strategyFilePath = path.resolve(process.cwd(), 'data', 'strategy.json');
    
    // Check if strategy file exists
    if (!fs.existsSync(strategyFilePath)) {
      return NextResponse.json(
        { error: 'No strategy data found. Generate a strategy first.' },
        { status: 404 }
      );
    }
    
    // Read and parse the strategy data
    const strategyData = JSON.parse(fs.readFileSync(strategyFilePath, 'utf8'));
    
    // Return the strategy data
    return NextResponse.json(strategyData);
  } catch (error) {
    console.error('Error in strategy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Execute the generate-strategy command
    console.log('Generating new strategy...');
    
    try {
      await executeCommand('npm', ['run', 'generate-strategy']);
    } catch (error) {
      console.error('Error generating strategy:', error);
      return NextResponse.json(
        { error: 'Failed to generate strategy' },
        { status: 500 }
      );
    }
    
    // Read the generated strategy
    const strategyFilePath = path.resolve(process.cwd(), 'data', 'strategy.json');
    
    // Check if strategy file exists
    if (!fs.existsSync(strategyFilePath)) {
      console.error('Strategy file not found after generation');
      return NextResponse.json(
        { error: 'Strategy generation failed' },
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 