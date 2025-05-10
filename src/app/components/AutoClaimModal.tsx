'use client'

import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { AUTO_CLAIM_DELEGATOR_ADDRESS } from '../lib/contractInfo'
import DelegatorABI from "../abi/AutoClaimDelegaor.json"
import type { Eip1193Provider } from 'ethers'

// This ABI will be used for future integration with a real contract
/*
const DELEGATOR_ABI = [
  "function delegateClaims(uint256 thresholdUsd, uint256 durationDays) external",
  "function revokeDelegation() external",
  "function getDelegationDetails(address user) external view returns (bool hasValidDelegation, uint256 threshold, uint256 expiry)"
];
*/

// We'll use the connected wallet address to determine the delegator contract
// For now we're not fully integrating with a real contract
// const DELEGATOR_CONTRACT_ADDRESS = ""; // Will be populated from settings if available

interface AutoClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: {
    claimThreshold: string;
    gasCost: string;
    compoundGasCost: string;
    timePeriod: string;
    walletAddress: string | null;
    useDelegation: boolean;
    delegationContractAddress?: string;
  }) => Promise<void>;
  connectedWallet: string;
}

export default function AutoClaimModal({ 
  isOpen, 
  onClose, 
  onSave,
  connectedWallet
}: AutoClaimModalProps) {
  // State for auto-claim settings
  const [claimThreshold, setClaimThreshold] = useState("0.004");
  const [gasCost, setGasCost] = useState("1.2");
  const [compoundGasCost, setCompoundGasCost] = useState("1.5");
  const [timePeriod, setTimePeriod] = useState('');
  const [restakeAmount, setRestakeAmount] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Delegation state - set to true by default
  const [useDelegation, setUseDelegation] = useState(true)
  const [hasDelegated, setHasDelegated] = useState(false)
  const [delegationExpiry, setDelegationExpiry] = useState<Date | null>(null)
  
  // Use a ref to track transaction success across renders
  const transactionSuccessRef = useRef(false);

  // Reset transaction success ref when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      transactionSuccessRef.current = false;
    }
  }, [isOpen]);
  
  // Fetch current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      checkDelegationStatus();
    }
  }, [isOpen, connectedWallet]);
  
  // Function to fetch current settings
  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claim/settings');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          // Set form values from saved settings
          setClaimThreshold(data.settings.minRewards?.toString() || '');
          setGasCost(data.settings.gasAware?.toString() || '');
          setCompoundGasCost(data.settings.compoundAware?.toString() || '');
          setTimePeriod(data.settings.timePeriod?.toString() || '');
          
          // If delegation settings exist, update the state
          if (data.settings.useDelegation !== undefined) {
            setUseDelegation(data.settings.useDelegation);
          }
        }
      }
    } catch (error) {
      console.error('Error loading auto claim settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to check delegation status
  const checkDelegationStatus = async () => {
    if (!connectedWallet) return;
    
    // 1. Check scheduler status
    let schedulerActive = false;
    try {
      const schedulerRes = await fetch('/api/claim/scheduler-status');
      const schedulerData = await schedulerRes.json();
      if (schedulerData.success && schedulerData.status) {
        // Optionally, check if the scheduler is running for this wallet
        schedulerActive = schedulerData.status.isRunning;
        // If you store the wallet address in the status, check it matches connectedWallet
        // schedulerActive = schedulerActive && schedulerData.status.walletAddress === connectedWallet;
      }
    } catch (e) {
      console.error('Error fetching scheduler status:', e);
    }

    // 2. If scheduler is not active, set hasDelegated to false and return
    if (!schedulerActive) {
      setHasDelegated(false);
      setDelegationExpiry(null);
      // Optionally, show a warning to the user here
      return;
    }

    // 3. If scheduler is active, check contract delegation as before
    try {
      // Check if Ethereum provider exists
      if (!window.ethereum) {
        console.log('MetaMask or compatible wallet not found');
        return;
      }
      
      // First try to get the contract address from settings
      const settingsResponse = await fetch('/api/claim/settings');
      const settingsData = await settingsResponse.json();
      
      // Get the chain ID to determine which contract address to use
      const ethereum = window.ethereum as Eip1193Provider;
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Use contract address from contractInfo or from settings
      let contractAddress = AUTO_CLAIM_DELEGATOR_ADDRESS[chainId as keyof typeof AUTO_CLAIM_DELEGATOR_ADDRESS];
      
      // If we have a custom address in settings, use that instead
      if (settingsData.success && 
          settingsData.settings?.delegationContractAddress && 
          ethers.isAddress(settingsData.settings.delegationContractAddress)) {
        contractAddress = settingsData.settings.delegationContractAddress;
      }
      
      // Check if we have a valid contract address
      if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        // For Sepolia (chain ID 11155111), use a specific test address
        if (chainId === 11155111) {
          contractAddress = "0xD2E1146CB2E4350b63242188Fcd931f047824E6B"; // Deployed AutoClaimDelegator contract
        } else {
          console.log("No valid contract address found for this network");
          
          // Set form values from saved settings
          if (settingsData.success && settingsData.settings) {
            setClaimThreshold(settingsData.settings.minRewards?.toString() || '');
            setGasCost(settingsData.settings.gasAware?.toString() || '');
            setCompoundGasCost(settingsData.settings.compoundAware?.toString() || '');
            setTimePeriod(settingsData.settings.timePeriod?.toString() || '');
            setUseDelegation(settingsData.settings.useDelegation || false);
          }
          return;
        }
      }
      
      // Initialize contract
      const delegatorContract = new ethers.Contract(
        contractAddress,
        DelegatorABI,
        provider
      );
      
      // Get delegation details
      console.log(`Checking delegation for ${connectedWallet} on contract ${contractAddress}`);
      const [hasValidDelegation, minRewardsUsd, gasAwareRatio, compoundAwareRatio, expiryTimestamp] = 
        await delegatorContract.getDelegationDetails(connectedWallet);
      
      // Update state based on delegation status
      setHasDelegated(hasValidDelegation);
      
      if (hasValidDelegation) {
        // Format values
        const rewardsUsd = ethers.formatUnits(minRewardsUsd, 18);
        const gasRatio = ethers.formatUnits(gasAwareRatio, 18);
        const compoundRatio = ethers.formatUnits(compoundAwareRatio, 18);
        
        // Format expiry
        const expiryDate = new Date(Number(expiryTimestamp) * 1000);
        setDelegationExpiry(expiryDate);
        
        // Set the form values to match delegation
        setClaimThreshold(rewardsUsd);
        setGasCost(gasRatio);
        setCompoundGasCost(compoundRatio);
        setUseDelegation(true);

      } else {
        // We don't have a delegation, but still load saved settings
        if (settingsData.success && settingsData.settings) {
          setClaimThreshold(settingsData.settings.minRewards?.toString() || '');
          setGasCost(settingsData.settings.gasAware?.toString() || '');
          setCompoundGasCost(settingsData.settings.compoundAware?.toString() || '');
          setTimePeriod(settingsData.settings.timePeriod?.toString() || '');
          setUseDelegation(settingsData.settings.useDelegation || false);
        }
        
        setDelegationExpiry(null);
      }
    } catch (error) {
      console.error('Error checking delegation status:', error);
      
      // Still try to load settings from API
      try {
        const response = await fetch('/api/claim/settings');
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            // Set form values from saved settings
            setClaimThreshold(data.settings.minRewards?.toString() || '');
            setGasCost(data.settings.gasAware?.toString() || '');
            setCompoundGasCost(data.settings.compoundAware?.toString() || '');
            setTimePeriod(data.settings.timePeriod?.toString() || '');
            setUseDelegation(data.settings.useDelegation || false);
          }
        }
      } catch (settingsError) {
        console.error('Error loading settings:', settingsError);
      }
    }
  };
  
  // Function to handle delegation
  const handleDelegation = async () => {
    if (!connectedWallet) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!useDelegation) {
      // If delegation is not enabled, just save the settings
      await saveSettings();
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setIsSuccess(false);
      
      // Check if Ethereum provider exists
      if (!window.ethereum) {
        setError('MetaMask or compatible wallet not found');
        return;
      }
      
      // Validate inputs - ensure at least one threshold is set
      const thresholdValue = parseFloat(claimThreshold);
      const gasValue = parseFloat(gasCost);
      const compoundValue = parseFloat(compoundGasCost);
      
      if ((isNaN(thresholdValue) || thresholdValue <= 0) &&
          (isNaN(gasValue) || gasValue <= 0) &&
          (isNaN(compoundValue) || compoundValue <= 0)) {
        setError('Please set at least one threshold value');
        setIsLoading(false);
        return;
      }
      
      // Parse time period
      const timeValue = parseFloat(timePeriod);
      if (isNaN(timeValue) || timeValue <= 0) {
        setError('Please enter a valid time period');
        setIsLoading(false);
        return;
      }
      
      // Get the chain ID to determine which contract address to use
      const ethereum = window.ethereum as Eip1193Provider;
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Use contract address from contractInfo
      let contractAddress = AUTO_CLAIM_DELEGATOR_ADDRESS[chainId as keyof typeof AUTO_CLAIM_DELEGATOR_ADDRESS];
      
      // Check if we have a deployed contract for this network
      if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        // For Sepolia (chain ID 11155111), use a specific test address
        if (chainId === 11155111) {
          contractAddress = "0xD2E1146CB2E4350b63242188Fcd931f047824E6B"; // Deployed AutoClaimDelegator contract
        } else {
          setError(`No deployed delegator contract found for this network (Chain ID: ${chainId})`);
          setIsLoading(false);
          return;
        }
      }
      
      // Check that contract address is not the same as the connected wallet
      if (contractAddress.toLowerCase() === connectedWallet.toLowerCase()) {
        setError("Contract address cannot be the same as your wallet address");
        return;
      }
      
      // Get signer and connect to contract
      const signer = await provider.getSigner();
      const delegatorContract = new ethers.Contract(
        contractAddress,
        DelegatorABI,
        signer
      );
      
      // Calculate duration in days
      const durationDays = Math.ceil(timeValue * 7); // Convert weeks to days
      
      // Convert values to wei (18 decimals)
      const minRewards = ethers.parseUnits(
        (isNaN(thresholdValue) ? "0" : thresholdValue.toString()), 
        18
      );
      const gasAwareRatio = ethers.parseUnits(
        (isNaN(gasValue) ? "0" : gasValue.toString()),
        18
      );
      const compoundAwareRatio = ethers.parseUnits(
        (isNaN(compoundValue) ? "0" : compoundValue.toString()),
        18
      );
      
      console.log(`Delegating with minRewards: ${thresholdValue}, gasAwareRatio: ${gasValue}, compoundAwareRatio: ${compoundValue} for ${durationDays} days`);
      
      // Execute the delegation with all 4 parameters
      const tx = await delegatorContract.delegateClaims(
        minRewards,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Save settings first
      try {
        const response = await fetch('/api/claim/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            claimThreshold,
            gasCost,
            compoundGasCost,
            timePeriod,
            walletAddress: connectedWallet,
            useDelegation: true,
            delegationContractAddress: contractAddress
          })
        });

        if (!response.ok) {
          console.error('Failed to save settings');
        }

        // Start the scheduler with immediate check and pass wallet address
        const startResponse = await fetch('/api/run-command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            command: 'npm',
            args: ['run', 'auto-claim-scheduler:run-now', '--', `--address=${connectedWallet}`]
          })
        });

        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          console.error('Failed to start scheduler:', errorData.error);
        } else {
          console.log('Scheduler started successfully');
        }
      } catch (error) {
        console.error('Error saving settings or starting scheduler:', error);
      }
      
      // Update state
      setHasDelegated(true);
      
      // Calculate expiry date
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + durationDays);
      setDelegationExpiry(newExpiry);
      
      // Show transaction hash
      setTxHash(receipt.hash);
      
      // Set success state immediately after confirmation
      setIsSuccess(true);
    } catch (error: unknown) {
      console.error('Error delegating claims:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error delegating claims';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to revoke delegation
  const handleRevokeDelegation = async () => {
    if (!connectedWallet) {
      setError('Please connect your wallet first');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if Ethereum provider exists
      if (!window.ethereum) {
        setError('MetaMask or compatible wallet not found');
        return;
      }
      
      // Get the chain ID to determine which contract address to use
      const ethereum = window.ethereum as Eip1193Provider;
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Use contract address from contractInfo
      let contractAddress = AUTO_CLAIM_DELEGATOR_ADDRESS[chainId as keyof typeof AUTO_CLAIM_DELEGATOR_ADDRESS];
      
      // Check if we have a contract for this network
      if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        // For Sepolia (chain ID 11155111), use a specific test address
        if (chainId === 11155111) {
          contractAddress = "0xD2E1146CB2E4350b63242188Fcd931f047824E6B"; // Deployed AutoClaimDelegator contract
        } else {
          setError(`No deployed delegator contract found for this network (Chain ID: ${chainId})`);
          setIsLoading(false);
          return;
        }
      }
      
      // Check that contract address is not the same as the connected wallet
      if (contractAddress.toLowerCase() === connectedWallet.toLowerCase()) {
        setError("Contract address cannot be the same as your wallet address");
        return;
      }
      
      // Get signer and connect to contract
      const signer = await provider.getSigner();
      const delegatorContract = new ethers.Contract(
        contractAddress,
        DelegatorABI, 
        signer
      );
      
      // Execute the revocation
      const tx = await delegatorContract.revokeDelegation();
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Stop the scheduler
      try {
        // Update settings with delegation disabled
        const response = await fetch('/api/claim/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            claimThreshold,
            gasCost,
            compoundGasCost,
            timePeriod,
            walletAddress: connectedWallet,
            useDelegation: false,
            delegationContractAddress: undefined
          })
        });

        if (!response.ok) {
          console.error('Failed to save settings');
        }
        
        // Use the scheduler API to stop the scheduler
        const stopResponse = await fetch('/api/claim/scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'stop'
          })
        });
        
        if (!stopResponse.ok) {
          const errorData = await stopResponse.json();
          console.error('Failed to stop scheduler:', errorData.error);
        } else {
          console.log('Scheduler stopped successfully');
        }
      } catch (error) {
        console.error('Error stopping scheduler:', error);
      }
      
      // Update state
      setHasDelegated(false);
      setDelegationExpiry(null);
      setUseDelegation(false);
      
      // Save settings with delegation disabled
      await onSave({
        claimThreshold,
        gasCost,
        compoundGasCost,
        timePeriod,
        walletAddress: connectedWallet,
        useDelegation: false,
        delegationContractAddress: undefined
      });
      
      // Show success state
      setIsSuccess(true);
      
      // Close modal after a delay
      setTimeout(() => {
        onClose();
        // Reset success state after the modal is closed
        setTimeout(() => setIsSuccess(false), 500);
      }, 2000);
    } catch (error: unknown) {
      console.error('Error revoking delegation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error revoking delegation';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to save settings
  const saveSettings = async (contractAddress?: string) => {
    try {
      await onSave({
        claimThreshold,
        gasCost,
        compoundGasCost,
        timePeriod,
        walletAddress: connectedWallet,
        useDelegation,
        delegationContractAddress: useDelegation ? contractAddress : undefined
      });
      
      setIsSuccess(true);
      
      // Close modal after a delay
      setTimeout(() => {
        onClose();
        // Reset success state after the modal is closed
        setTimeout(() => setIsSuccess(false), 500);
      }, 2000);
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings. Please try again.');
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Always handle delegation since we've set it as the default and only option
    await handleDelegation();
  };
  
  // Function to render success UI - separated to ensure it's properly handled
  const renderSuccessUI = () => {
    console.log('Rendering success UI, isSuccess:', isSuccess);
    
    return (
      <div className="p-6 flex flex-col items-center text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <h2 className="text-xl font-medium text-white mb-2">
          {hasDelegated ? "Delegation Successful!" : "Undelegation Successful!"}
        </h2>
        {hasDelegated ? (
          <p className="text-gray-400 mb-4">
            Your rewards will be claimed automatically using secure on-chain delegation when they meet your configured thresholds.
          </p>
        ) : (
          <p className="text-gray-400 mb-4">
            You have successfully revoked the auto-claim delegation.
          </p>
        )}
        {txHash && (
          <div className="mt-4 text-blue-400 text-sm">
            Transaction: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}</a>
          </div>
        )}
      </div>
    );
  };

  const handleDelegate = async () => {
    if (!connectedWallet) {
      setError('Please connect your wallet first');
      return;
    }

    // Reset states at beginning
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setIsSuccess(false);
    // Reset success ref
    transactionSuccessRef.current = false;
    
    console.log('Starting delegation process...');

    try {
      // Check if Ethereum provider exists
      if (!window.ethereum) {
        setError('MetaMask or compatible wallet not found');
        return;
      }

      // Switch to Sepolia network
      const ethereum = window.ethereum as Eip1193Provider;
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
      });

      // Create provider with proper type checking
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Make sure we have a contract address for this network
      let delegatorContractAddress = AUTO_CLAIM_DELEGATOR_ADDRESS[chainId as keyof typeof AUTO_CLAIM_DELEGATOR_ADDRESS];
      
      // Check if the contract address is valid
      if (!delegatorContractAddress || delegatorContractAddress === "0x0000000000000000000000000000000000000000") {
        // For Sepolia (chain ID 11155111), use a specific test address
        if (chainId === 11155111) {
          delegatorContractAddress = "0xD2E1146CB2E4350b63242188Fcd931f047824E6B"; // Deployed AutoClaimDelegator contract
        } else {
          setError(`No valid contract address for network ${chainId}. Please contact support.`);
          return;
        }
      }
      
      // Check that contract address is not the same as the connected wallet
      if (delegatorContractAddress.toLowerCase() === connectedWallet.toLowerCase()) {
        setError("Contract address cannot be the same as your wallet address");
        return;
      }
      
      const delegator = new ethers.Contract(delegatorContractAddress, DelegatorABI, signer);
      
      // Convert form values to the correct format
      const minRewards = ethers.parseUnits(claimThreshold || "0", 18);
      const gasAwareRatio = ethers.parseUnits(gasCost || "0", 18);
      const compoundAwareRatio = ethers.parseUnits(compoundGasCost || "0", 18);
      // Calculate duration in days
      const durationDays = parseInt(timePeriod || "0") * 7; // Convert weeks to days

      console.log('Sending transaction to contract...');
      // Call the delegateClaims function with the correct parameters according to our ABI
      const tx = await delegator.delegateClaims(
        minRewards,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );

      console.log('Transaction sent, waiting for confirmation...', tx.hash);
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed with hash:', receipt.hash);
      
      // Mark transaction as successful using ref
      transactionSuccessRef.current = true;
      
      // Update UI state in a synchronous block
      console.log('Updating UI state after TX confirmation');
      setHasDelegated(true);
      setTxHash(receipt.hash);
      
      // Calculate expiry date
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + durationDays);
      setDelegationExpiry(newExpiry);

      // Set success state explicitly
      console.log('Setting success state to TRUE');
      setIsSuccess(true);
      
      // Force a small delay to let state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Success state is now:', isSuccess, 'ref is:', transactionSuccessRef.current);
      
      // Now save settings and start scheduler
      try {
        console.log('Saving settings...');
        const response = await fetch('/api/claim/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            claimThreshold,
            gasCost,
            compoundGasCost,
            timePeriod,
            walletAddress: connectedWallet,
            useDelegation: true,
            delegationContractAddress: delegatorContractAddress
          })
        });

        if (!response.ok) {
          console.error('Failed to save settings');
        } else {
          console.log('Settings saved successfully');
        }

        console.log('Starting scheduler...');
        // Start the scheduler via the dedicated API
        const startResponse = await fetch('/api/claim/scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'start',
            walletAddress: connectedWallet
          })
        });

        if (!startResponse.ok) {
          console.error('Failed to start scheduler');
        }
      } catch (error) {
        console.error('Error saving settings or starting scheduler:', error);
        // Continue with UI update even if there was an error with settings or scheduler
      }
      
      // Use a timeout to ensure the component has time to rerender
      // before we try to close the modal
      setTimeout(() => {
        // Only close if our ref still indicates success
        if (transactionSuccessRef.current) {
          console.log('Closing modal after successful transaction');
          onClose();
        }
      }, 3000);
    } catch (error: unknown) {
      console.error('Delegation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delegate claims');
      setIsSuccess(false);
      transactionSuccessRef.current = false;
    } finally {
      // Make sure loading state is reset even if there's an error
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  console.log('Rendering modal, isSuccess:', isSuccess, 'ref:', transactionSuccessRef.current);
  
  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.75)] z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-xl w-full p-6 relative border border-gray-800">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {!isSuccess ? (
          <form onSubmit={handleSubmit}>
            <h2 className="text-white mb-3">Set up Auto Claim and Restake</h2>
            {/* <p className="text-gray-300 text-xs mb-4">
              Secure automatic claiming of rewards using our on-chain delegation system.
            </p> */}
            
            {hasDelegated ? (
              <div className="mb-6 p-3 bg-green-900/20 border border-green-800 rounded-md">
                <div className="flex items-center text-green-400 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Delegation Active</span>
                </div>
                <p className="text-sm text-gray-300">
                  You have delegated claim permissions until{' '}
                  {delegationExpiry?.toLocaleDateString() || 'unknown'}.
                </p>
              </div>
            ) : (  
              <div className="mb-6 p-3 bg-blue-900/20 border border-blue-800 rounded-md">
                <div className="flex items-center text-sm text-blue-400 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="">Secure On-Chain Delegation</span>
                </div>
                <p className="text-xs text-gray-300">
                  This will delegate claim and restake permissions to our service via smart contract.
                  You maintain full control of your funds and can revoke access at any time.
                </p>
              </div>
              )}

            {/* Claim Threshold */}
            <div className="relative flex flex-col border border-gray-800 items-start gap-2 px-4 py-4 mb-4">
              <div className="absolute -top-2 left-2 bg-gray-900 px-2 flex items-center">
                <h3 className="text-gray-200 text-sm">Claim Thresholds</h3>
              </div>
              <div className='flex flex-col pt-4 w-full space-y-4'>
                {/* Min Rewards */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <label className="absolute -top-2 left-2 bg-gray-900 text-xs px-2 text-gray-300">Min rewards</label>
                      <input
                        type="text"
                        value={claimThreshold}
                        onChange={(e) => setClaimThreshold(e.target.value)}
                        className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        USD
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Only claim if rewards larger than this USD value.</p>
                </div>
                
                {/* Gas Aware */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <label className="absolute -top-2 left-2 bg-gray-900 text-xs px-2 text-gray-300">Gas aware</label>
                      <input
                        type="text"
                        value={gasCost}
                        onChange={(e) => setGasCost(e.target.value)}
                        className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        × Gas Cost
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Only claim if rewards / gas ratio is larger than this value.</p>
                </div>
                
                {/* Compound Aware */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <label className="absolute -top-2 left-2 bg-gray-900 text-xs px-2 text-gray-300">Compound aware</label>
                      <input
                        type="text"
                        value={compoundGasCost}
                        onChange={(e) => setCompoundGasCost(e.target.value)}
                        className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        × Gas Cost
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Only claim if expected compound reward / gas ratio is larger than this value.</p>
                </div>
              </div>
            </div>

            {/* Auto Restake */}
            <div className="relative flex flex-col border border-gray-800 items-start gap-2 px-4 py-2 mb-6">
              <div className="absolute -top-2 left-2 bg-gray-900 px-2 flex items-center">
                <h3 className="text-gray-200 text-sm">Restake Rewards</h3>
              </div>
              <div className='flex flex-col pt-4'>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={restakeAmount}
                      onChange={(e) => setRestakeAmount(e.target.value)}
                      className="w-64 px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        %
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">Restake x percenct of the rewards.</p>
              </div>
            </div>
            
            {/* Time Period */}
            <div className="relative flex flex-col border border-gray-800 items-start gap-2 px-4 py-2 mb-6">
              <div className="absolute -top-2 left-2 bg-gray-900 px-2 flex items-center">
                <h3 className="text-gray-200 text-sm">Time Period</h3>
              </div>
              <div className='flex flex-col pt-4'>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={timePeriod}
                      onChange={(e) => setTimePeriod(e.target.value)}
                      className="w-64 px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        Weeks
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">For how long the delegation will be active.</p>
              </div>
            </div>



            
            {/* Error message */}
            {error && (
              <div className="mb-4 bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {/* Confirm Button */}

            {hasDelegated ? (
              <button
                type="button"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium rounded-md transition"
                disabled={isLoading || isSuccess}
                onClick={handleRevokeDelegation}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Undelegating...
                  </>
                ) : (
                  'Revoke Delegation'
                )}
              </button>
            ):(
              <button
              type="button"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium rounded-md transition"
              disabled={isLoading || isSuccess}
              onClick={handleDelegate}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Delegating...
                </>
              ) : (
                'Delegate & Enable Auto-Claim'
              )}
            </button>
            )}


            
            {txHash && (
              <div className="mt-2 text-green-500">
                Success! Tx: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">{txHash}</a>
              </div>
            )}
          </form>
        ) : renderSuccessUI()}
      </div>
    </div>
  )
} 