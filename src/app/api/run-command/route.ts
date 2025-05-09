import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Execute command as a promise
async function executeCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      cwd: path.resolve(process.cwd(), '..'), // Run in project root directory
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr
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
      console.log(`Command exited with code ${code}`);
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// POST handler to run commands
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const data = await request.json();
    const { command, args } = data;
    
    // Security check - only allow specific commands
    const allowedCommands = ['npm'];
    const allowedArgs = ['run'];
    
    if (!allowedCommands.includes(command)) {
      return NextResponse.json(
        { error: 'Command not allowed' },
        { status: 403 }
      );
    }
    
    if (args[0] && !allowedArgs.includes(args[0])) {
      return NextResponse.json(
        { error: 'Args not allowed' },
        { status: 403 }
      );
    }
    
    // Execute the command - let autoClaimScheduler.ts manage its own status
    try {
      const output = await executeCommand(command, args);
      console.log("Command execution successful");
      
      return NextResponse.json({
        success: true,
        message: 'Command executed successfully',
        output: output.substring(0, 500) // Truncate long outputs
      });
    } catch (error) {
      console.error('Command execution error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  } catch (error) {
    console.error('Error executing command:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Command execution failed' },
      { status: 500 }
    );
  }
} 