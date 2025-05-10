import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to execution logs directory
    const logsDir = path.join(process.cwd(), 'data', 'auto_restake_logs');
    
    // Read all files in the directory
    const files = await fs.readdir(logsDir);
    
    // Filter for specific execution log files (excluding bpt_staking files)
    const jsonFiles = files.filter(file => 
      file.startsWith('restake_result_') && file.endsWith('.json')
    );
    
    // Sort files by name (timestamp) in descending order to get newest first
    jsonFiles.sort().reverse();
    
    // Read content of each file
    const logsPromises = jsonFiles.map(async (file) => {
      const content = await fs.readFile(path.join(logsDir, file), 'utf8');
      return JSON.parse(content);
    });
    
    const logs = await Promise.all(logsPromises);
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error reading restake logs:', error);
    return NextResponse.json({ error: 'Failed to fetch restake logs' }, { status: 500 });
  }
} 