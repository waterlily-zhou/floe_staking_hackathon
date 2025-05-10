import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dataType = url.searchParams.get('type') || 'all';
    
    // Define paths to data files
    const dataDir = path.resolve(process.cwd(), 'data');
    const poolsFilePath = path.join(dataDir, 'pools.json');
    const gaugesFilePath = path.join(dataDir, 'gauges.json');
    
    let responseData = {};
    
    // Read the requested data
    if (dataType === 'pools' || dataType === 'all') {
      try {
        const poolsData = JSON.parse(readFileSync(poolsFilePath, 'utf8'));
        responseData = { ...responseData, pools: poolsData };
      } catch (error) {
        console.error('Error reading pools data:', error);
        if (dataType === 'pools') {
          return NextResponse.json(
            { error: 'Failed to read pools data' }, 
            { status: 500 }
          );
        }
      }
    }
    
    if (dataType === 'gauges' || dataType === 'all') {
      try {
        const gaugesData = JSON.parse(readFileSync(gaugesFilePath, 'utf8'));
        responseData = { ...responseData, gauges: gaugesData };
      } catch (error) {
        console.error('Error reading gauges data:', error);
        if (dataType === 'gauges') {
          return NextResponse.json(
            { error: 'Failed to read gauges data' }, 
            { status: 500 }
          );
        }
      }
    }
    
    if (Object.keys(responseData).length === 0) {
      return NextResponse.json(
        { error: 'No data available or invalid data type requested' }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error handling data request:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 