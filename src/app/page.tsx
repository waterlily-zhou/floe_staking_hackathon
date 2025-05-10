'use client'

import { useState, useEffect } from 'react'
import StrategyTab from './components/StrategyTab'
import CompoundTab from './components/CompoundTab'

// Define ethereum on window object for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string, params?: unknown[] }) => Promise<string[]>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener?: (event: string, callback: (accounts: string[]) => void) => void;
      isMetaMask?: boolean;
    }
  }
}

export default function Home() {
  // State to track the active tab
  const [activeTab, setActiveTab] = useState('strategy')
  // Add state for wallet connection
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  
  // Check for existing wallet connection on page load
  useEffect(() => {
    // Check if MetaMask is installed
    if (typeof window !== 'undefined' && window.ethereum) {
      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        })
        .catch(console.error);

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletAddress('');
        } else {
          setWalletAddress(accounts[0]);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  // Function to connect to MetaMask
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed! Please install MetaMask to use this feature.');
      return;
    }

    setIsConnecting(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setWalletAddress(address);
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          setWalletAddress('');
        } else {
          setWalletAddress(accounts[0]);
        }
      });
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      alert('Failed to connect to MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Format address for display
  const formatAddress = (address: string) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  };

  return (
    <main className="min-h-screen bg-black text-gray-200">
      {/* Header */}
      <div className="border-b border-blue-600 py-4 px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-blue-600">floe_staking</h1>
          </div>
          <div className="flex items-center justify-start -mb-px">
            <button
              onClick={() => setActiveTab('strategy')}
              className={`py-2 px-6 font-medium text-sm  ${
                activeTab === 'strategy'
                  ? 'text-blue-500'
                  : 'text-gray-300 hover:text-gray-300'
              }`}
            >
              AI Strategy
            </button>
            <button
              onClick={() => setActiveTab('compound')}
              className={`py-2 px-6 font-medium text-sm ${
                activeTab === 'compound'
                  ? 'text-blue-500'
                  : 'text-gray-300 hover:text-gray-300'
              }`}
            >
              Auto Compound
            </button>
          </div>
          <div className="hidden md:flex space-x-4 text-sm">
            <button 
              className="text-blue-500 border border-blue-600 hover:bg-blue-700 hover:text-white px-4 py-2 rounded-md transition flex items-center space-x-1 mr-8"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : walletAddress ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatAddress(walletAddress)}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
            <a href="https://github.com/waterlily-zhou/auto-compound-ai" 
               className="text-gray-200 hover:text-blue-300 transition flex items-center space-x-1"
               target="_blank" rel="noopener noreferrer">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.237 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'strategy' ? (
          <StrategyTab 
            connectedWallet={walletAddress}
          />
        ) : (
          <CompoundTab isActive={activeTab === 'compound'} connectedWallet={walletAddress} />
        )}
      </div>
    </main>
  )
}


