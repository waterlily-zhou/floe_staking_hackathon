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
  const [actionLoading, setActionLoading] = useState(false);
  
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
  
  // Function to start the scheduler
  const startScheduler = async () => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claim/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh status after starting
        fetchStatus();
      } else {
        setError(data.error || 'Failed to start scheduler');
      }
    } catch (err) {
      setError('Error connecting to the server');
      console.error('Error starting scheduler:', err);
    } finally {
      setActionLoading(false);
    }
  };
  
  // Function to stop the scheduler
  const stopScheduler = async () => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claim/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh status after stopping
        fetchStatus();
      } else {
        setError(data.error || 'Failed to stop scheduler');
      }
    } catch (err) {
      setError('Error connecting to the server');
      console.error('Error stopping scheduler:', err);
    } finally {
      setActionLoading(false);
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
      
      <div className="mt-3 flex space-x-2">
        <button 
          onClick={fetchStatus}
          className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing
            </span>
          ) : 'Refresh'}
        </button>
        
        {status && (
          <>
            {status.isRunning ? (
              <button 
                onClick={stopScheduler}
                className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Stopping
                  </span>
                ) : 'Stop Scheduler'}
              </button>
            ) : (
              <button 
                onClick={startScheduler}
                className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting
                  </span>
                ) : 'Start Scheduler'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AutoClaimStatus; 