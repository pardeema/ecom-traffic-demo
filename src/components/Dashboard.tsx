// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrafficChart from './TrafficChart';
import { TrafficLog } from '@/types'; // Still needed for RecentTrafficTable

const CHART_POLLING_INTERVAL_MS = 5000; // Poll aggregated data every 5 seconds
const RECENT_LOGS_POLLING_INTERVAL_MS = 15000; // Poll raw logs every 15 seconds
const RECENT_LOGS_LIMIT = 20; // Max raw logs to show in the table

// Type for the aggregated data from the new API endpoint
interface DashboardDataPoint {
  timestamp: number; // Unix timestamp (seconds) for the start of the interval
  loginCount: number;
  checkoutCount: number;
}

// --- Recent Traffic Table (Component remains the same) ---
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
            <tr key={`${item.timestamp}-${index}-${item.ip}`}> {/* Improved key */}
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
// --- End Recent Traffic Table ---



const Dashboard: React.FC = () => {
  // Chart display options - UPDATED DEFAULTS AND VALUES
  const [chartTimeWindowMinutes, setChartTimeWindowMinutes] = useState<number>(5); // Default 5 minutes
  const [chartIntervalSeconds, setChartIntervalSeconds] = useState<number>(10); // Default 10 seconds

  const [chartData, setChartData] = useState<DashboardDataPoint[]>([]);
  const [recentLogs, setRecentLogs] = useState<TrafficLog[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(true);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const chartIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Fetch aggregated data for charts ---
  const fetchChartData = useCallback(async () => {
    const url = `/api/dashboard-data?windowMinutes=${chartTimeWindowMinutes}&intervalSeconds=${chartIntervalSeconds}`;
    console.log(`Workspaceing chart data: ${url}`); // Keep for debugging if needed
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Chart API error! status: ${response.status}`);
      }
      const data: DashboardDataPoint[] = await response.json();
      setChartData(data);
      setChartError(null);
    } catch (err) {
      console.error(`Error fetching chart data:`, err);
      setChartError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setChartLoading(false);
    }
  }, [chartTimeWindowMinutes, chartIntervalSeconds]);

  // --- Fetch recent raw logs for the table ---
  const fetchRecentLogs = useCallback(async () => {
    const url = `/api/traffic?limit=${RECENT_LOGS_LIMIT}`;
    console.log(`Workspaceing recent logs: ${url}`); // Keep for debugging if needed
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Recent Logs API error! status: ${response.status}`);
      }
      const logs: TrafficLog[] = await response.json();
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentLogs(logs);
      setLogsError(null);
    } catch (err) {
      console.error(`Error fetching recent logs:`, err);
      setLogsError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // --- Effects for initial load and polling ---
  useEffect(() => {
    setChartLoading(true);
    fetchChartData();
    if (chartIntervalRef.current) clearInterval(chartIntervalRef.current);
    chartIntervalRef.current = setInterval(fetchChartData, CHART_POLLING_INTERVAL_MS);
    return () => {
      if (chartIntervalRef.current) clearInterval(chartIntervalRef.current);
    };
  }, [fetchChartData]);

  useEffect(() => {
    setLogsLoading(true);
    fetchRecentLogs();
    if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
    logsIntervalRef.current = setInterval(fetchRecentLogs, RECENT_LOGS_POLLING_INTERVAL_MS);
    return () => {
      if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
    };
  }, [fetchRecentLogs]);

  // Prepare data for charts
  const loginChartData = chartData.map(d => ({ timestamp: d.timestamp, count: d.loginCount }));
  const checkoutChartData = chartData.map(d => ({ timestamp: d.timestamp, count: d.checkoutCount }));

  // --- Render Logic ---
  if (chartLoading || logsLoading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Traffic Dashboard</h1>
        <div className="time-filter">
            <label htmlFor="timeWindow">Chart Window:</label>
            {/* UPDATED Time Window Options */}
            <select
              id="timeWindow"
              value={chartTimeWindowMinutes}
              onChange={(e) => setChartTimeWindowMinutes(Number(e.target.value))}
            >
              <option value={2}>Last 2 min</option>
              <option value={5}>Last 5 min</option> {/* Default */}
              <option value={10}>Last 10 min</option>
            </select>

            <label htmlFor="interval">Interval:</label>
            {/* UPDATED Interval Options */}
             <select
                id="interval"
                value={chartIntervalSeconds}
                onChange={(e) => setChartIntervalSeconds(Number(e.target.value))}
              >
               <option value={5}>5 sec</option>
               <option value={10}>10 sec</option> {/* Default */}
               <option value={30}>30 sec</option>
             </select>
        </div>
      </div>

      {chartError && <p className="error-message">Chart Data Error: {chartError}</p>}
      {logsError && <p className="error-message">Recent Logs Error: {logsError}</p>}

      <div className="charts-container">
        <div className="chart-section">
          <h2>Login Endpoint Activity</h2>
          <TrafficChart
            aggregatedData={loginChartData}
            label="Logins"
          />
        </div>
        <div className="chart-section">
          <h2>Checkout Endpoint Activity</h2>
          <TrafficChart
            aggregatedData={checkoutChartData}
            label="Checkouts"
          />
        </div>
      </div>

      <div className="recent-traffic">
        <h2>Recent Requests (Last {recentLogs.length})</h2>
        <RecentTrafficTable data={recentLogs} />
      </div>

      {/* Styles remain the same */}
      <style jsx>{`
        .dashboard { padding: 20px; max-width: 1200px; margin: auto; }
        .dashboard-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; }
        .time-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .time-filter label { margin-right: 5px; white-space: nowrap; }
        .time-filter select { padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
        .charts-container { display: grid; grid-template-columns: 1fr; gap: 30px; margin-bottom: 30px; }
        @media (min-width: 768px) { .charts-container { grid-template-columns: 1fr 1fr; } }
        .chart-section, .recent-traffic { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .chart-section h2, .recent-traffic h2 { margin-top: 0; margin-bottom: 15px; font-size: 18px; color: #333; }
        .loading { display: flex; justify-content: center; align-items: center; height: 200px; font-size: 18px; }
        .error-message { color: red; border: 1px solid red; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
      `}</style>
    </div>
  );
};

export default Dashboard;