import { NextResponse } from 'next/server';
import path from 'path';
import fetchGaugeData from '@agent/fetchGaugeData';

export async function POST() {
  try {
    console.log('Fetching new gauge and pool data...');

    try {
      // Directly call the fetchGaugeData function
      await fetchGaugeData(100); // Pass 100 as the limit parameter
      
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