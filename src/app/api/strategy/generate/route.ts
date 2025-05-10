import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import analyzeAndGenerateStrategy from '@agent/aiAnalysis';

export async function POST() {
  try {
    console.log('Generating new strategy...');
    
    try {
      // Run the analysis directly
      await analyzeAndGenerateStrategy();
      
      // Read the generated strategy file
      const strategyFilePath = path.resolve(process.cwd(), 'data', 'strategy.json');
      
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