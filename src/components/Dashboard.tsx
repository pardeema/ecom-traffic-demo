// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrafficChart from './TrafficChart'; // Assuming this component exists
import { TrafficLog } from '@/types'; // Assuming this type is defined

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_LOGS_IN_STATE = 200; // Limit the number of logs kept in each state array

// --- Recent Traffic Table ---
const RecentTrafficTable: React.FC<{ data: TrafficLog[] }> = ({ data }) => {
  if (!data || data.length === 0) { // Added null check for safety
    return <p>No recent traffic data available.</p>;
  }

  return (
    <div className="traffic-table">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Endpoint</th>
            <th>Method</th>
            <th>IP Address</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.timestamp}-${index}`}> {/* Improved key */}
              <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
              <td>{item.endpoint}</td>
              <td>{item.method}</td>
              {/* Use optional chaining and nullish coalescing for safer access */}
              <td>{item.realIp ?? item.headers?.["x-real-ip"] ?? item.ip ?? 'N/A'}</td>
              <td>{item.statusCode ?? 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <style jsx>{`
        .traffic-table { width: 100%; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; white-space: nowrap; }
        th { background-color: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f0f0f0; }
      `}</style>
    </div>
  );
};
// --- End Recent Traffic Table ---


const Dashboard: React.FC = () => {
  // Time window state (kept for potential chart display logic, not for fetching)
  const [timeWindow, setTimeWindow] = useState<number>(5);

  // State for different log types
  const [loginLogs, setLoginLogs] = useState<TrafficLog[]>([]);
  const [checkoutLogs, setCheckoutLogs] = useState<TrafficLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<TrafficLog[]>([]); // All recent logs for the table

  // Loading and error state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to store the latest timestamp *in milliseconds*
  const latestTimestampRef = useRef<number | null>(null);

  // Ref to manage the polling interval timer
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Function to process new logs and update state ---
  const processNewLogs = (newLogs: TrafficLog[]) => {
    if (!newLogs || newLogs.length === 0) {
      console.log("processNewLogs received no new logs.");
      return;
    };
    console.log(`processNewLogs received ${newLogs.length} new log(s) to prepend.`);
    const newLoginLogs = newLogs.filter(log => log.endpoint === '/api/auth/login');
    const newCheckoutLogs = newLogs.filter(log => log.endpoint === '/api/checkout');

    // Prepend new logs and limit array size
    if (newLoginLogs.length > 0) {
      setLoginLogs(prev => [...newLoginLogs, ...prev].slice(0, MAX_LOGS_IN_STATE));
    }
    if (newCheckoutLogs.length > 0) {
      setCheckoutLogs(prev => [...newCheckoutLogs, ...prev].slice(0, MAX_LOGS_IN_STATE));
    }
    // Prepend all new logs to the recent logs table data
    setRecentLogs(prev => [...newLogs, ...prev].slice(0, MAX_LOGS_IN_STATE));
  };

  // --- Function to fetch traffic updates (used for both initial and incremental) ---
  const fetchUpdates = useCallback(async (isInitialLoad = false) => {
    // Construct the URL, adding 'since' parameter only for incremental fetches
    let url = '/api/traffic/incremental';
    const currentLatestTimestamp = latestTimestampRef.current; // Capture ref value

    if (!isInitialLoad && currentLatestTimestamp) {
      // Add 1ms to 'since' to avoid fetching the same last event again (exclusive)
      url += `?since=${currentLatestTimestamp + 1}`;
    }

    console.log(`Fetching updates: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Handle potential rate limits or other errors gracefully
        if (response.status === 429) {
            console.warn('Rate limited. Consider increasing polling interval.');
            // Optionally stop polling or implement backoff
        }
        throw new Error(`API error! status: ${response.status}`);
      }
      const data: { logs: TrafficLog[], latestTimestamp: number } = await response.json();

      console.log(`API Response for ${url}:`, {
          logsReceived: data.logs, // See exactly what logs the API returned
          latestTimestampReceived: data.latestTimestamp
      });

      // Process the received logs
      processNewLogs(data.logs);

      // Update the latest timestamp ref with the value from the API response
      // Ensure we only move the timestamp forward
      if (data.latestTimestamp && (!currentLatestTimestamp || data.latestTimestamp > currentLatestTimestamp)) {
           latestTimestampRef.current = data.latestTimestamp;
           console.log(`Updated latest timestamp to: ${new Date(latestTimestampRef.current).toISOString()}`);
      }

      setError(null); // Clear previous errors on successful fetch

    } catch (err) {
      console.error(`Error fetching ${isInitialLoad ? 'initial' : 'incremental'} traffic data:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      // Optional: Stop polling on error?
      // if (intervalRef.current) clearInterval(intervalRef.current);
    } finally {
       // Set loading to false only after the *initial* load attempt
       if (isInitialLoad) {
           setLoading(false);
       }
    }
  }, []); // No dependencies needed for useCallback as it uses refs

  // --- Effect for initial load ---
  useEffect(() => {
    console.log('Performing initial data fetch...');
    fetchUpdates(true); // Pass true for initial load
    // Intentionally not adding fetchUpdates to dependency array to run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Effect for setting up polling ---
  useEffect(() => {
    // Don't start polling until initial load is finished
    if (loading) {
        console.log('Waiting for initial load to complete before starting polling...');
        return;
    }

    console.log('Setting up polling interval...');
    // Clear previous interval if it exists (e.g., due to fast refresh)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up the polling interval
    intervalRef.current = setInterval(() => {
        console.log('Polling for updates...');
        fetchUpdates(false); // Pass false for incremental updates
    }, POLLING_INTERVAL_MS);

    // Cleanup function to clear interval on component unmount
    return () => {
      console.log('Clearing polling interval.');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loading, fetchUpdates]); // Depend on loading state and fetchUpdates function


  // --- Render Logic ---
  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Traffic Dashboard</h1>
        {/* Time window selector (kept for chart display, doesn't affect fetching) */}
        <div className="time-filter">
          <label htmlFor="timeWindow">Chart Time Window:</label>
          <select
            id="timeWindow"
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
          >
            <option value={1}>Last 1 minute</option>
            <option value={5}>Last 5 minutes</option>
            <option value={10}>Last 10 minutes</option>
            {/* Add more options if needed */}
          </select>
        </div>
      </div>

      {error && <p style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px' }}>Error fetching data: {error}</p>}

      <div className="charts-container">
        <div className="chart-section">
          <h2>Login Endpoint</h2>
          {/* Pass only the relevant logs and the display timeWindow to the chart */}
          <TrafficChart
            data={loginLogs}
            endpoint="/api/auth/login"
            timeWindow={timeWindow} // Chart might use this for display filtering
          />
        </div>

        <div className="chart-section">
          <h2>Checkout Endpoint</h2>
          <TrafficChart
            data={checkoutLogs}
            endpoint="/api/checkout"
            timeWindow={timeWindow}
          />
        </div>
      </div>

      <div className="recent-traffic">
        <h2>Recent Requests (Latest {recentLogs.length})</h2>
        <RecentTrafficTable data={recentLogs} />
      </div>

      {/* Keep existing styles */}
      <style jsx>{`
        .dashboard { padding: 20px; max-width: 1200px; margin: auto; }
        .dashboard-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; }
        .time-filter { display: flex; align-items: center; gap: 10px; }
        .time-filter select { padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
        .charts-container { display: grid; grid-template-columns: 1fr; gap: 30px; margin-bottom: 30px; }
        @media (min-width: 768px) { .charts-container { grid-template-columns: 1fr 1fr; } }
        .chart-section, .recent-traffic { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .chart-section h2, .recent-traffic h2 { margin-top: 0; margin-bottom: 15px; font-size: 18px; color: #333; }
        .loading { display: flex; justify-content: center; align-items: center; height: 200px; font-size: 18px; }
      `}</style>
    </div>
  );
};

export default Dashboard;
