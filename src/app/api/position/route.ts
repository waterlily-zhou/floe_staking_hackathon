import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { readStakingPosition } from '@agent/readPositions';


export async function GET(request: Request) {
  try {
    // Get wallet address and refresh parameter from the query
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('address');
    const refresh = url.searchParams.get('refresh');
    
    // Use default address if not provided
    const addressToUse = walletAddress || '0x4Aa0B81F700b7053F98eD21e704B25F1A4A52e69';
    
    console.log(`Fetching position for address: ${addressToUse}, refresh=${refresh}`);
    
    // Make sure data directory exists
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const positionFile = path.join(dataDir, 'position.json');
    
    // Only use cache if refresh is not set and cache exists
    if (!refresh && fs.existsSync(positionFile)) {
      console.log(`Using cached position data from ${positionFile}`);
      // Read and parse the position data
      const positionData = JSON.parse(fs.readFileSync(positionFile, 'utf8'));
      // Return the cached position data
      return NextResponse.json(positionData);
    }
    
    // Otherwise, get fresh data
    console.log(`Getting fresh position data for ${addressToUse}`);
    const positionData = await readStakingPosition(addressToUse);
    
    // Save the fresh data to the cache file
    fs.writeFileSync(positionFile, JSON.stringify(positionData, null, 2));
    console.log(`Saved fresh position data to ${positionFile}`);
    
    // Return the position data
    return NextResponse.json(positionData);
  } catch (error) {
    console.error('Error fetching position:', error);
    return NextResponse.json(
      { error: 'Failed to fetch position data' },
      { status: 500 }
    );
  }
} 