'use client'

import { useState, useEffect } from 'react'
import AutoClaimStatus from './AutoClaimStatus'
import AutoClaimModal from './AutoClaimModal'
import { ethers } from 'ethers';

// Define types for our data
interface TokenData {
  amount: string;
  valueUSD: number;
  price: number;
}

interface Position {
  unstaked: {
    balance: string;
    token: string;
    valueUSD: number;
  };
  staked: {
    balance: string;
    token: string;
    valueUSD: number;
  };
  rewards: Record<string, TokenData>;
  totalRewardsUSD: number;
  totalPositionValueUSD: number;
}

// Define interfaces for the claim logs
interface RewardToken {
  token: string;
  symbol: string;
  amount: string;
  valueUSD: number;
}

interface ClaimGauge {
  gaugeAddress: string;
  gaugeName: string;
  rewards: RewardToken[];
}

interface ClaimLogSummary {
  totalClaimed: number;
  totalGasCost?: number;
  netProfit?: number;
  errors: string[];
}

interface ClaimLog {
  timestamp: string;
  isMockMode: boolean;
  strategyGenerated: string;
  claims: ClaimGauge[];
  summary: ClaimLogSummary;
}

// Define interfaces for the restake logs
interface RewardAction {
  type: string;
  gauges: {
    gaugeAddress: string;
    rewards: RewardToken[];
  }[];
}

interface StakeAction {
  type: string;
  gaugeAddress: string;
  gaugeName?: string;
  amount: string;
}

interface StrategyPool {
  poolName: string;
  gaugeAddress: string;
  allocationPercentage: number;
}

interface RestakeStrategy {
  generatedAt: string;
  recommendedPools: StrategyPool[];
}

interface RestakeLogSummary {
  totalClaimed: number;
  totalRestaked: number;
  errors: string[];
}

interface RestakeLog {
  timestamp: string;
  isMockMode: boolean;
  strategy: RestakeStrategy;
  actions: (RewardAction | StakeAction)[];
  summary: RestakeLogSummary;
}

// Update the CompoundLog interface to match the actual log files
interface CompoundLog {
  timestamp: string;
  action: string;
  isMockMode?: boolean;
  gauges?: Array<{
    name: string;
    address: string;
    amount: string;
    token: string;
    value?: number;
  }>;
  totalValue: number;
  details?: string;
}

export default function CompoundTab({ isActive, connectedWallet }: { isActive: boolean, connectedWallet: string }) {
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Auto claim state
  const [showAutoClaimModal, setShowAutoClaimModal] = useState(false)
  const [autoClaimLoading, setAutoClaimLoading] = useState(false)
  
  // Compound state
  const [compoundLoading, setCompoundLoading] = useState(false)
  const [compoundResult, setCompoundResult] = useState<{success?: boolean, totalClaimed?: number, totalRestaked?: number} | null>(null)
  
  // Logs state
  const [logs, setLogs] = useState<CompoundLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  
  // Function to save auto claim settings
  const saveAutoClaimSettings = async (settings: {
    claimThreshold: string;
    gasCost: string;
    compoundGasCost: string;
    timePeriod: string;
    walletAddress: string | null;
    useDelegation: boolean;
    delegationContractAddress?: string;
  }) => {
    setAutoClaimLoading(true);
    
    try {
      // Send settings to the API with delegation parameters
      const response = await fetch('/api/claim/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claimThreshold: settings.claimThreshold.trim() !== '' ? settings.claimThreshold : null,
          gasCost: settings.gasCost.trim() !== '' ? settings.gasCost : null,
          compoundGasCost: settings.compoundGasCost.trim() !== '' ? settings.compoundGasCost : null,
          timePeriod: settings.timePeriod.trim() !== '' ? settings.timePeriod : null,
          walletAddress: settings.walletAddress || connectedWallet || null,
          useDelegation: settings.useDelegation,
          delegationContractAddress: settings.delegationContractAddress
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      // Log success (could be removed in production)
      console.log('Auto-claim settings saved successfully:', settings);
      
      // Refresh position data to reflect new settings
      if (connectedWallet) {
        fetchPosition(connectedWallet);
      }
      
      // Close the modal after a successful save is handled by the modal component
    } catch (error) {
      console.error('Error saving auto claim settings:', error);
      throw error; // Let the modal component handle the error
    } finally {
      setAutoClaimLoading(false);
    }
  };
  
  // Fetch position data and logs when the component mounts or when isActive changes to true
  useEffect(() => {
    if (isActive) {
      fetchLogs()
      // Only fetch position if we have a connected wallet
      if (connectedWallet) {
        fetchPosition(connectedWallet)
      }
    }
  }, [isActive, connectedWallet])
    
  const fetchPosition = async (address?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // Always use refresh=1 to get fresh data
      const url = address 
        ? `/api/position?address=${address}&refresh=1`
        : '/api/position?refresh=1';
        
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to load position data')
      }
      
      const data = await response.json()
      setPosition(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching position data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchLogs = async () => {
    try {
      // Fetch both claim and restake logs
      const [claimLogsResponse, restakeLogsResponse] = await Promise.all([
        fetch('/api/logs/claim'),
        fetch('/api/logs/restake')
      ]);
      
      if (!claimLogsResponse.ok || !restakeLogsResponse.ok) {
        throw new Error('Failed to fetch logs');
      }
      
      const claimLogs: ClaimLog[] = await claimLogsResponse.json();
      const restakeLogs: RestakeLog[] = await restakeLogsResponse.json();
      
      // Process claim logs
      const formattedClaimLogs: CompoundLog[] = claimLogs.map((log) => {
        // Format claim logs
        const formattedGauges = log.claims?.map((claim) => ({
          name: claim.gaugeName || 'Unknown Pool',
          address: claim.gaugeAddress,
          amount: claim.rewards.reduce((total, reward) => 
            total + parseFloat(reward.amount || '0'), 0).toFixed(2),
          token: claim.rewards.map((r) => r.symbol).join('/'),
          value: claim.rewards.reduce((total, reward) => total + (reward.valueUSD || 0), 0)
        })) || [];
        
        return {
          timestamp: log.timestamp,
          action: 'Claim',
          isMockMode: log.isMockMode,
          gauges: formattedGauges,
          totalValue: log.summary?.totalClaimed || 0,
          details: `Claimed rewards from ${formattedGauges.length} gauges`
        };
      });
      
      // Process restake logs
      const formattedRestakeLogs: CompoundLog[] = restakeLogs.map((log) => {
        // Extract stake actions
        const stakeActions = log.actions?.filter((action): action is StakeAction => 
          action.type === 'stake'
        ) || [];
        
        // Format stake actions as gauges
        const formattedGauges = stakeActions.map((action) => ({
          name: action.gaugeName || 'Unknown Pool',
          address: action.gaugeAddress,
          amount: ethers.formatEther(action.amount), // Format the BigInt amount
          token: 'BPT', // Balancer Pool Tokens
          value: parseFloat(ethers.formatEther(action.amount)) * 1000 // Approximate value based on amount
        }));
        
        return {
          timestamp: log.timestamp,
          action: 'Restake',
          isMockMode: log.isMockMode,
          gauges: formattedGauges,
          totalValue: log.summary?.totalRestaked || 0,
          details: `Restaked to ${formattedGauges.length} gauges according to strategy`
        };
      });
      
      // Combine and sort logs by timestamp (newest first)
      const allLogs = [...formattedClaimLogs, ...formattedRestakeLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setLogs(allLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    }
  };
  
  const handleRefreshClick = () => {
    if (connectedWallet) {
      fetchPosition(connectedWallet);
    } else {
      fetchPosition();
    }
  };
  
  const restakeRewards = async () => {
    setCompoundLoading(true)
    setCompoundResult(null)
    
    try {
      if (!connectedWallet) {
        throw new Error('Please connect your wallet first')
      }
      
      const response = await fetch('/api/restake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: connectedWallet
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to restake rewards')
      }
      
      const data = await response.json()
      setCompoundResult(data)
      
      // Refresh position data after restaking
      fetchPosition(connectedWallet)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while restaking rewards'
      setError(errorMessage)
    } finally {
      setCompoundLoading(false)
    }
  }
  
  // Filter logs to remove entries with 0 values
  const filteredLogs = logs.filter(log => log.totalValue > 0);
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-lg shadow p-6 md:col-span-2">
          <h2 className="font-semibold text-gray-100 mb-3">Auto Compound Dashboard</h2>
          <p className="text-gray-400 text-sm mb-3">
            View your current staking positions on Balancer, claim rewards, and automatically restake according to your strategy.
          </p>
          <div className="flex space-x-6">
            <button
              onClick={() => setShowAutoClaimModal(true)}
              className="px-4 py-2 text-sm bg-blue-700/80 text-white rounded-md hover:bg-blue-800 transition font-medium"
              disabled={loading || autoClaimLoading}
            >
              {autoClaimLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : 'Set up auto claim and restake'}
            </button>
          </div>
        </div>
        {/* Auto Claim Status Component */}
        <div className="md:col-span-1">
          <AutoClaimStatus />
        </div>
      </div>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="space-y-6">
        {/* Current Positions Section with Action Buttons */}
        <div className="bg-gray-900 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-gray-100">Current Positions</h3>
            <button 
              onClick={handleRefreshClick}
              className="text-gray-200 hover:text-blue-500 transition"
              aria-label="Refresh positions"
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="px-6 py-4">
            {loading ? (
              // Skeleton loader for positions
              <div className="animate-pulse">
                {/* Staked Position Skeleton */}
                <div className="mb-6">
                  <div className="relative border border-gray-800 rounded-md p-4 my-4">
                    <div className="absolute -top-2 left-2 bg-gray-900 px-2">
                      <div className="h-4 w-28 bg-gray-700 rounded"></div>
                    </div>
                    <div className="flex justify-between items-start mt-2">
                      <div className="h-6 w-40 bg-gray-700 rounded"></div>
                      <div className="h-6 w-24 bg-gray-700 rounded"></div>
                    </div>
                    
                    {/* Skeleton for rewards */}
                    <div className="relative mt-4 border-t border-gray-800 pt-4">
                      <div className="absolute -top-2 left-0 bg-gray-900 pr-2">
                        <div className="h-4 w-32 bg-gray-700 rounded"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-4 w-12 bg-gray-700 rounded"></div>
                          <div className="h-4 w-24 bg-gray-700 rounded"></div>
                        </div>
                        <div className="flex justify-between">
                          <div className="h-4 w-12 bg-gray-700 rounded"></div>
                          <div className="h-4 w-24 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Unstaked Position Skeleton */}
                <div>
                  <div className="relative border border-gray-800 rounded-md p-4">
                    <div className="absolute -top-2 left-2 bg-gray-900 px-2">
                      <div className="h-4 w-32 bg-gray-700 rounded"></div>
                    </div>
                    <div className="flex justify-between items-start mt-2">
                      <div className="h-6 w-40 bg-gray-700 rounded"></div>
                      <div className="h-6 w-24 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : position ? (
              <>
                {/* Staked Position */}
                {position.staked && parseFloat(position.staked.balance) > 0 ? (
                  <div className="mb-6">
                    <div className="relative border border-gray-800 rounded-md p-4 my-4">
                      <h4 className="absolute -top-2 left-2 bg-gray-900 px-2 font-medium text-sm text-gray-300">Staked Position</h4>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-blue-500 mt-2">{parseFloat(position.staked.balance).toFixed(2)} {position.staked.token}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-blue-500">${position.staked.valueUSD.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {/* Claimable Rewards for this position */}
                      {Object.keys(position.rewards || {}).length > 0 && (
                        <div className="relative mt-4 border-t border-gray-800 pt-4">
                          <h5 className="absolute -top-2 left-0 bg-gray-900 pr-2 text-sm text-gray-300 mb-2">Claimable Rewards</h5>
                          <div className="space-y-2">
                            {Object.entries(position.rewards || {}).map(([token, data]: [string, TokenData]) => (
                              <div key={token} className="flex justify-between items-center text-sm">
                                <span className="text-gray-100">{token}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-gray-100">{parseFloat(data.amount).toFixed(4)}</span>
                                  <span className="text-xs text-gray-500">${data.valueUSD.toFixed(4)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                  
                {/* Unstaked Position */}
                <div>
                    <div className="relative border border-gray-800 rounded-md p-4">
                      <h4 className="absolute -top-2 left-2 bg-gray-900 px-2 text-sm text-gray-300">Unstaked Position</h4>
                      <div className="flex justify-between items-baseline text-gray-300 pt-2">
                        {position.unstaked && parseFloat(position.unstaked.balance) > 0 ? (
                          <>
                            <span>{position.unstaked.balance} {position.unstaked.token}</span>
                            <span className="font-semibold text-blue-500">${position.unstaked.valueUSD.toFixed(4)}</span>
                          </>
                        ) : 
                        <p className="text-gray-500 text-sm italic">You have no unstaked position.</p>}
                      </div>
                    </div>
                  </div>
                
                {/* Show this if no positions */}
                {(!position.staked || parseFloat(position.staked.balance) === 0) && 
                 (!position.unstaked || parseFloat(position.unstaked.balance) === 0) && (
                  <div className="text-center py-4 text-gray-500">No positions found</div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {connectedWallet ? 'Loading position data...' : 'Connect wallet to view your positions'}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <ClaimableRewardsSection loading={loading} position={position} connectedWallet={connectedWallet} />
        </div>
        
        {/* Compound Log Section */}
        <div className="bg-gray-900 rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-gray-100">Compound Log</h3>
            <button 
              onClick={() => setLogsLoading(!logsLoading)}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              {logsLoading ? 'Show Less' : 'Show More'}
            </button>
          </div>
          
          <div className="px-6 py-4">
            {filteredLogs.length > 0 ? (
              <div className="space-y-6">
                {(logsLoading ? filteredLogs : filteredLogs.slice(0, 5)).map((log, index) => (
                  <div key={index} className="border-b border-gray-800 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        {log.action === 'Claim' ? (
                          <div className="bg-blue-900 rounded-full p-1.5 mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="bg-green-900 rounded-full p-1.5 mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-300" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-gray-200">{log.action}</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    
                    {/* Display detailed gauge information */}
                    <div className="space-y-3 mt-2">
                      {log.gauges?.map((gauge, idx) => (
                        <div key={idx} className="ml-7 text-sm flex justify-between items-center">
                          <div className="flex-1">
                            {log.action === 'Claim' ? (
                              <div className="flex items-baseline">
                                <span className="text-blue-400 text-xs font-medium">{gauge.amount} {gauge.token}</span>
                                <span className="text-gray-400 mx-1 text-xs">from</span>
                                <a 
                                  href={`https://app.balancer.fi/#/ethereum/pool/${gauge.address}`} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-300 text-xs hover:text-blue-400 transition"
                                >
                                  {gauge.name}
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-baseline">
                                <span className="text-green-400 text-xs font-medium">{gauge.amount} {gauge.token}</span>
                                <span className="text-gray-400 mx-1 text-xs">to</span>
                                <a 
                                  href={`https://app.balancer.fi/#/ethereum/pool/${gauge.address}`} 
          target="_blank"
          rel="noopener noreferrer"
                                  className="text-gray-300 text-xs hover:text-green-400 transition"
                                >
                                  {gauge.name}
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={log.action === 'Claim' ? 'text-blue-400 text-xs' : 'text-green-400 text-xs'}>
                              ${gauge.value?.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Total value */}
                    <div className="mt-3 ml-7 pt-2 border-t border-gray-800 text-sm flex justify-between">
                      <span className="text-gray-400">Total:</span>
                      <span className={log.action === 'Claim' ? 'text-blue-400 font-medium' : 'text-green-400 font-medium'}>
                        {log.totalValue > 0 
                          ? `$${log.totalValue.toFixed(2)}` 
                          : log.action === 'Claim' ? 'No rewards claimed' : 'No funds restaked'}
                      </span>
                    </div>
                  </div>
                ))}
                
                {filteredLogs.length > 5 && !logsLoading && (
                  <div className="text-center">
                    <button 
                      onClick={() => setLogsLoading(true)}
                      className="text-blue-400 hover:text-blue-300 text-sm transition"
                    >
                      Show {filteredLogs.length - 5} more logs...
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No compound logs found</div>
            )}
          </div>
        </div>
        
        {/* Results Display */}
        {compoundResult && (
          <div className="bg-blue-900/20 border border-blue-800 text-blue-300 px-4 py-3 rounded-md">
            <div className="font-medium">Rewards restaked successfully!</div>
            <div className="text-sm mt-1">
              Restaked ${compoundResult.totalRestaked?.toFixed(2) || '0.00'} worth of rewards.
            </div>
          </div>
        )}
      </div>
      
      {!position && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-gray-400 font-medium mb-2">No Position Data</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Click &quot;Refresh Position&quot; to view your current staking position and rewards.
          </p>
        </div>
      )}
      
      {/* Auto Claim Modal */}
      {showAutoClaimModal && (
        <AutoClaimModal
          isOpen={showAutoClaimModal}
          onClose={() => setShowAutoClaimModal(false)}
          onSave={saveAutoClaimSettings}
          connectedWallet={connectedWallet || ''}
        />
      )}
    </div>
  )
}

function ClaimableRewardsSection({ loading, position, connectedWallet }: { loading: boolean, position: Position | null, connectedWallet: string }) {
  return (
    <div className="bg-gray-900 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-gray-100">Claimable Rewards</h3>
      </div>
      
      <div className="px-6 py-4">
        {loading ? (
          // Skeleton loader for rewards
          <div className="animate-pulse space-y-3">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-900 rounded-full p-1.5">
                  <div className="h-4 w-4 bg-blue-700 rounded-full"></div>
                </div>
                <div className="h-4 w-20 bg-gray-700 rounded"></div>
              </div>
              <div className="flex flex-col items-end">
                <div className="h-4 w-24 bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-16 bg-gray-700 rounded"></div>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-900 rounded-full p-1.5">
                  <div className="h-4 w-4 bg-blue-700 rounded-full"></div>
                </div>
                <div className="h-4 w-16 bg-gray-700 rounded"></div>
              </div>
              <div className="flex flex-col items-end">
                <div className="h-4 w-20 bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-14 bg-gray-700 rounded"></div>
              </div>
            </div>
            
            <div className="pt-2 flex justify-between items-center">
              <div className="h-4 w-20 bg-gray-700 rounded"></div>
              <div className="h-5 w-16 bg-blue-900/50 rounded"></div>
            </div>
          </div>
        ) : position && Object.keys(position.rewards || {}).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(position.rewards || {}).map(([token, data]: [string, TokenData]) => (
              <div key={token} className="flex justify-between items-center border-b border-gray-800 text-sm pb-3">
                <div className="flex items-center space-x-2">
                  <div className="bg-blue-900 rounded-full p-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-200">{token}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-gray-200">{parseFloat(data.amount).toFixed(4)}</span>
                  <span className="text-sm text-gray-500">${data.valueUSD.toFixed(4)}</span>
                </div>
              </div>
            ))}
            
            <div className="pt-2 flex justify-between items-center">
              <span className="font-medium text-gray-300">Total Value</span>
              <span className="font-semibold text-blue-500">
                ${position.totalRewardsUSD?.toFixed(6) || '0.000000'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {connectedWallet ? 'No claimable rewards found' : 'Connect wallet to view your rewards'}
          </div>
        )}
      </div>
    </div>
  );
}
