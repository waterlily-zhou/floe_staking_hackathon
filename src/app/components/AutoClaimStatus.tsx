import { useState, useEffect } from 'react';

interface AutoClaimSettings {
  minRewards: number;
  gasAware: number;
  compoundAware: number;
  timePeriod: number;
  setAt: string;
}

interface SchedulerStatus {
  isRunning: boolean;
  startedAt: string | null;
  lastUpdated: string | null;
  lastSchedulerLog: string | null;
  lastClaimCheck: string | null;
  nextScheduledRun: string | null;
}

const AutoClaimStatus: React.FC = () => {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [settings, setSettings] = useState<AutoClaimSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to fetch scheduler status
  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claim/scheduler-status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        setSettings(data.settings);
      } else {
        setError(data.error || 'Failed to fetch scheduler status');
      }
    } catch (err) {
      setError('Error connecting to the server');
      console.error('Error fetching scheduler status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch status on component mount
  useEffect(() => {
    fetchStatus();
    
    // Set up a refresh timer (every 30 seconds)
    const timer = setInterval(fetchStatus, 30000);
    
    // Clean up timer on unmount
    return () => clearInterval(timer);
  }, []);
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not available';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };
  
  // Calculate time ago for display
  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return 'just now';
    } catch {
      return '';
    }
  };
  
  return (
    <div className="bg-gradient-to-br from-blue-900 to-blue-950 rounded-lg p-4 shadow-lg text-white">
      <h3 className="mb-2 flex items-center">
        <div className={`h-3 w-3 rounded-full mr-2 ${status?.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
        Delegation Status
      </h3>
      
      {loading && <p className="text-sm text-blue-200">Refreshing status...</p>}
      
      {error && <p className="text-sm text-red-300">{error}</p>}
      
      {status && (
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-blue-300">Status:</span>{' '}
            {status.isRunning ? (
              <span className="text-green-400 font-medium">Active</span>
            ) : (
              <span className="text-red-400 font-medium">Inactive</span>
            )}
          </div>
          
          {status.lastClaimCheck && (
            <div>
              <span className="text-blue-300">Last check:</span>{' '}
              <span className="text-white">{getTimeAgo(status.lastClaimCheck)}</span>
              <div className="text-xs text-blue-200">{formatDate(status.lastClaimCheck)}</div>
            </div>
          )}
          
          {status.nextScheduledRun && (
            <div>
              <span className="text-blue-300">Next check:</span>{' '}
              <div className="text-white">{formatDate(status.nextScheduledRun)}</div>
            </div>
          )}
          
          {settings && status.isRunning && (
            <div className="mt-2 pt-2 border-t border-blue-800">
              <p className="text-blue-300">Threshold:</p>{' '}
              <p className="text-white">• Rewards ≥ ${settings.minRewards.toFixed(3)}</p>
              <p className="text-white">• Rewards ≥ {settings.gasAware.toFixed(0)} × gas cost</p>
              <p className="text-white">• Compounded rewards ≥ {settings.compoundAware.toFixed(0)} × gas cost</p>
            </div>
          )}
        </div>
      )}
      
      {!status && !loading && !error && (
        <p className="text-sm text-blue-200">No status information available</p>
      )}
      
      <div className="mt-3">
        <button 
          onClick={fetchStatus}
          className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
          disabled={loading}
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
};

export default AutoClaimStatus; 