// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrafficChart from './TrafficChart';
import { TrafficLog } from '@/types';

const POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds (reduced from 5)
const MAX_LOGS_IN_STATE = 100; // Reduced from 200 to improve performance

// --- Recent Traffic Table ---
const RecentTrafficTable: React.FC<{ data: TrafficLog[] }> = ({ data }) => {
  if (!data || data.length === 0) {
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
            <tr key={`${item.timestamp}-${index}`}>
              <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
              <td>{item.endpoint}</td>
              <td>{item.method}</td>
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

const Dashboard: React.FC = () => {
  // Time window state (used for chart display)
  const [timeWindow, setTimeWindow] = useState<number>(5);

  // State for different log types
  const [loginLogs, setLoginLogs] = useState<TrafficLog[]>([]);
  const [checkoutLogs, setCheckoutLogs] = useState<TrafficLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<TrafficLog[]>([]);

  // Chart data state
  const [loginChartData, setLoginChartData] = useState<number[]>([]);
  const [checkoutChartData, setCheckoutChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);

  // Loading and error state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to store the latest timestamp for incremental fetching
  const latestTimestampRef = useRef<number | null>(null);
  
  // Ref for animation frame
  const animationFrameRef = useRef<number | null>(null);
  
  // Ref to track when we last received new data
  const lastDataUpdateRef = useRef<number>(Date.now());
  
  // Ref to store server-client time offset
  const timeOffsetRef = useRef<number>(0);

  // --- Initial data load ---
  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      try {
        const response = await fetch(`/api/traffic/combined?timeWindow=${timeWindow}`);
        if (!response.ok) {
          throw new Error(`API error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process login and checkout logs
        setLoginLogs(data.login || []);
        setCheckoutLogs(data.checkout || []);
        setRecentLogs(data.recent || []);
        
        // Set chart data
        if (data.chart) {
          setChartLabels(data.chart.labels);
          setLoginChartData(data.chart.loginData);
          setCheckoutChartData(data.chart.checkoutData);
        }
        
        // Set the latest timestamp for subsequent incremental fetches
        if (data.timestamp) {
          const serverTime = new Date(data.timestamp).getTime();
          const clientTime = Date.now();
          timeOffsetRef.current = serverTime - clientTime;
          
          // If logs exist, find the newest one for our timestamp
          if (data.recent && data.recent.length > 0) {
            latestTimestampRef.current = Math.max(
              ...data.recent.map((log: TrafficLog) => new Date(log.timestamp).getTime())
            );
          } else {
            latestTimestampRef.current = serverTime;
          }
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [timeWindow]);

  // --- Incremental data polling ---
  useEffect(() => {
    if (loading) return;
    
    const fetchIncrementalData = async () => {
      try {
        // Only fetch if we have a timestamp to start from
        if (!latestTimestampRef.current) return;
        
        const url = `/api/traffic/incremental?since=${latestTimestampRef.current}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update with new logs only if we received any
        if (data.all && data.all.length > 0) {
          // Update the last data update timestamp
          lastDataUpdateRef.current = Date.now();
          
          // Process login logs
          if (data.login && data.login.length > 0) {
            setLoginLogs(prev => [...data.login, ...prev].slice(0, MAX_LOGS_IN_STATE));
          }
          
          // Process checkout logs
          if (data.checkout && data.checkout.length > 0) {
            setCheckoutLogs(prev => [...data.checkout, ...prev].slice(0, MAX_LOGS_IN_STATE));
          }
          
          // Update recent logs
          if (data.all.length > 0) {
            setRecentLogs(prev => [...data.all, ...prev].slice(0, 10));
          }
        }
        
        // Always update the latest timestamp
        if (data.latestTimestamp) {
          latestTimestampRef.current = data.latestTimestamp;
        }
        
        // Update server-client time offset if server time is provided
        if (data.serverTime) {
          const currentClientTime = Date.now();
          timeOffsetRef.current = data.serverTime - currentClientTime;
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching incremental data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };
    
    // Set up polling interval
    const intervalId = setInterval(fetchIncrementalData, POLLING_INTERVAL_MS);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [loading]);

  // --- Real-time chart animation ---
  useEffect(() => {
    if (loading) return;
    
    // Function to update chart data
    const updateChartData = () => {
      // Get the current time adjusted with server offset
      const now = new Date(Date.now() + timeOffsetRef.current);
      
      // Generate new time buckets based on current time
      const bucketCount = timeWindow * 2; // 30-second buckets
      const bucketInterval = 30 * 1000; // 30 seconds
      
      const newLabels: string[] = [];
      const newTimestamps: Date[] = [];
      
      for (let i = bucketCount - 1; i >= 0; i--) {
        const bucketTime = new Date(now.getTime() - i * bucketInterval);
        const hours = bucketTime.getHours().toString().padStart(2, '0');
        const minutes = bucketTime.getMinutes().toString().padStart(2, '0');
        const seconds = bucketTime.getSeconds() < 30 ? '00' : '30';
        
        newLabels.push(`${hours}:${minutes}:${seconds}`);
        newTimestamps.push(bucketTime);
      }
      
      // Fill buckets with existing log data
      const newLoginData = new Array(bucketCount).fill(0);
      const newCheckoutData = new Array(bucketCount).fill(0);
      
      // Process login logs
      loginLogs.forEach(log => {
        const logTime = new Date(log.timestamp);
        
        for (let i = 0; i < newTimestamps.length - 1; i++) {
          if (logTime >= newTimestamps[i] && logTime < newTimestamps[i + 1]) {
            newLoginData[i]++;
            break;
          }
        }
        
        // Check the last bucket
        if (logTime >= newTimestamps[newTimestamps.length - 1] && 
            logTime <= now) {
          newLoginData[newTimestamps.length - 1]++;
        }
      });
      
      // Process checkout logs
      checkoutLogs.forEach(log => {
        const logTime = new Date(log.timestamp);
        
        for (let i = 0; i < newTimestamps.length - 1; i++) {
          if (logTime >= newTimestamps[i] && logTime < newTimestamps[i + 1]) {
            newCheckoutData[i]++;
            break;
          }
        }
        
        // Check the last bucket
        if (logTime >= newTimestamps[newTimestamps.length - 1] && 
            logTime <= now) {
          newCheckoutData[newTimestamps.length - 1]++;
        }
      });
      
      // Update chart data state
      setChartLabels(newLabels);
      setLoginChartData(newLoginData);
      setCheckoutChartData(newCheckoutData);
      
      // Schedule next animation frame
      animationFrameRef.current = requestAnimationFrame(updateChartData);
    };
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(updateChartData);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [loading, loginLogs, checkoutLogs, timeWindow]);

  // Calculate statistics using the most recent data
  const calculateStatistics = useCallback(() => {
    const now = Date.now() + timeOffsetRef.current;
    const oneMinuteAgo = now - 60000;
    const tenSecondsAgo = now - 10000;
    
    const loginLastMinute = loginLogs.filter(
      log => new Date(log.timestamp).getTime() >= oneMinuteAgo
    ).length;
    
    const checkoutLastMinute = checkoutLogs.filter(
      log => new Date(log.timestamp).getTime() >= oneMinuteAgo
    ).length;
    
    const loginLastTenSeconds = loginLogs.filter(
      log => new Date(log.timestamp).getTime() >= tenSecondsAgo
    ).length;
    
    const checkoutLastTenSeconds = checkoutLogs.filter(
      log => new Date(log.timestamp).getTime() >= tenSecondsAgo
    ).length;
    
    return {
      loginLastMinute,
      checkoutLastMinute,
      loginLastTenSeconds,
      checkoutLastTenSeconds
    };
  }, [loginLogs, checkoutLogs]);
  
  const stats = calculateStatistics();

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Traffic Dashboard</h1>
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
          </select>
        </div>
      </div>

      {error && <p className="error-message">Error fetching data: {error}</p>}

      <div className="charts-container">
        <div className="chart-section">
          <h2>Login Endpoint</h2>
          <TrafficChart
            labels={chartLabels}
            data={loginChartData}
            endpoint="/api/auth/login"
            lastMinuteCount={stats.loginLastMinute}
            lastTenSecondsCount={stats.loginLastTenSeconds}
          />
        </div>

        <div className="chart-section">
          <h2>Checkout Endpoint</h2>
          <TrafficChart
            labels={chartLabels}
            data={checkoutChartData}
            endpoint="/api/checkout"
            lastMinuteCount={stats.checkoutLastMinute}
            lastTenSecondsCount={stats.checkoutLastTenSeconds}
          />
        </div>
      </div>

      <div className="recent-traffic">
        <h2>Recent Requests (Latest {recentLogs.length})</h2>
        <RecentTrafficTable data={recentLogs} />
      </div>

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
        .error-message { background-color: #ffebee; color: #d32f2f; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
      `}</style>
    </div>
  );
};

export default Dashboard;