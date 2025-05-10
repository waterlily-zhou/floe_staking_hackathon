import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { readStakingPosition } from '@agent/readPositions';


export async function GET(request: Request) {
  try {
    // Get wallet address from the query parameter
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('address');
    
    // Use default address if not provided
    const addressToUse = walletAddress || '0x4Aa0B81F700b7053F98eD21e704B25F1A4A52e69';
    
    console.log(`Fetching position for address: ${addressToUse}`);
    
    try {
      // First try to get cached position from files
      const dataDir = path.resolve(process.cwd(), 'data');
      const positionFile = path.join(dataDir, 'position.json');
      
      // Check if position.json exists
      if (fs.existsSync(positionFile)) {
        console.log(`Found position data at ${positionFile}`);
        // Read and parse the position data
        const positionData = JSON.parse(fs.readFileSync(positionFile, 'utf8'));
        // Return the cached position data
        return NextResponse.json(positionData);
      }
      
      // If no cached data, directly call readStakingPosition
      const positionData = await readStakingPosition(addressToUse);
      
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