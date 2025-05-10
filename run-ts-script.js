#!/usr/bin/env node

/**
 * This is a wrapper script for running TypeScript files with ts-node
 * It handles issues with ESM and TypeScript file extensions
 * 
 * Usage: node run-ts-script.js <ts-file-path> [arguments]
 * Example: node run-ts-script.js agent/autoClaimScheduler.ts --run-now
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the TypeScript file path from command line arguments
const tsFilePath = process.argv[2];

if (!tsFilePath) {
  console.error('Error: No TypeScript file path provided');
  console.error('Usage: node run-ts-script.js <ts-file-path> [arguments]');
  process.exit(1);
}

// Check if the file exists
if (!fs.existsSync(tsFilePath)) {
  console.error(`Error: File not found: ${tsFilePath}`);
  process.exit(1);
}

// Pass all remaining arguments to the script
const scriptArgs = process.argv.slice(3);

// Build the arguments for ts-node
const args = [
  '-T', // Transpile-only mode
  '--skip-project', // Skip reading project references
  '--transpile-only', // Transpile only, don't type-check
  tsFilePath,
  ...scriptArgs
];

console.log(`Running: ts-node ${args.join(' ')}`);

// Spawn ts-node process
const child = spawn('npx', ['ts-node', ...args], {
  stdio: 'inherit', // Inherit stdin/stdout/stderr from parent process
  shell: true
});

// Handle process exit
child.on('exit', (code) => {
  process.exit(code);
}); 