import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the auto claim settings interface
interface AutoClaimSettings {
  minRewards: number;
  gasAware: number;
  compoundAware: number;
  timePeriod: number;
  setAt: string;
  useDelegation?: boolean;
  delegationContractAddress?: string;
  walletAddress?: string;
}

// Settings file path (relative to project root, not the ui directory)
const SETTINGS_FILE_PATH = path.resolve(process.cwd(), '..', 'data', 'auto_claim_settings.json');

// Default settings
const DEFAULT_SETTINGS: AutoClaimSettings = {
  minRewards: 1.0,
  gasAware: 1.2,
  compoundAware: 1.5,
  timePeriod: 4,
  setAt: new Date().toISOString(),
  useDelegation: false,
  walletAddress: undefined
};

// Ensure directory exists
function ensureDirectoryExists(filepath: string) {
  const dirname = path.dirname(filepath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// Load settings from file or return defaults
function loadSettings(): AutoClaimSettings {
  try {
    ensureDirectoryExists(SETTINGS_FILE_PATH);
    
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      const settings = JSON.parse(data) as AutoClaimSettings;
      
      // Validate and provide defaults for any missing fields
      return {
        minRewards: settings.minRewards ?? DEFAULT_SETTINGS.minRewards,
        gasAware: settings.gasAware ?? DEFAULT_SETTINGS.gasAware,
        compoundAware: settings.compoundAware ?? DEFAULT_SETTINGS.compoundAware,
        timePeriod: settings.timePeriod ?? DEFAULT_SETTINGS.timePeriod,
        setAt: settings.setAt ?? DEFAULT_SETTINGS.setAt,
        useDelegation: settings.useDelegation ?? DEFAULT_SETTINGS.useDelegation,
        delegationContractAddress: settings.delegationContractAddress ?? DEFAULT_SETTINGS.delegationContractAddress,
        walletAddress: settings.walletAddress ?? DEFAULT_SETTINGS.walletAddress
      };
    } else {
      // Create default settings file if it doesn't exist
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    console.error("Error loading auto claim settings:", error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings to file
function saveSettings(settings: Partial<AutoClaimSettings>): AutoClaimSettings {
  try {
    ensureDirectoryExists(SETTINGS_FILE_PATH);
    
    // Merge with existing settings
    const currentSettings = loadSettings();
    const newSettings: AutoClaimSettings = {
      ...currentSettings,
      ...settings,
      setAt: new Date().toISOString()
    };
    
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(newSettings, null, 2));
    console.log("Auto claim settings saved successfully");
    return newSettings;
  } catch (error) {
    console.error("Error saving auto claim settings:", error);
    throw error;
  }
}

// GET handler - retrieve current settings
export async function GET() {
  try {
    const settings = loadSettings();
    
    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error retrieving auto claim settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve auto claim settings' },
      { status: 500 }
    );
  }
}

// POST handler - save new settings
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Get wallet address from the request body
    const walletAddress = data.walletAddress;
    const useDelegation = data.useDelegation === true;
    const delegationContractAddress = data.delegationContractAddress;

    // Convert string values to numbers if provided as strings
    const settings: Partial<AutoClaimSettings> = {
      minRewards: data.claimThreshold !== undefined ? parseFloat(data.claimThreshold) : undefined,
      gasAware: data.gasCost !== undefined ? parseFloat(data.gasCost) : undefined,
      compoundAware: data.compoundGasCost !== undefined ? parseFloat(data.compoundGasCost) : undefined,
      timePeriod: data.timePeriod !== undefined ? parseFloat(data.timePeriod) : undefined,
      useDelegation: useDelegation,
      delegationContractAddress: delegationContractAddress,
      walletAddress: walletAddress
    };
    
    // Filter out undefined values
    Object.keys(settings).forEach(key => {
      if (settings[key as keyof typeof settings] === undefined) {
        delete settings[key as keyof typeof settings];
      }
    });
    
    // Save settings
    const updatedSettings = saveSettings(settings);
    
    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      message: 'Auto claim settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving auto claim settings:', error);
    return NextResponse.json(
      { error: 'Failed to save auto claim settings' },
      { status: 500 }
    );
  }
} 