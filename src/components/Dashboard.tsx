// src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import TrafficChart from './TrafficChart';
import { TrafficLog } from '@/types';

interface DashboardData {
  login: TrafficLog[];
  checkout: TrafficLog[];
  recent: TrafficLog[];
  timestamp: string;
}

// Recent Traffic Table component
const RecentTrafficTable: React.FC<{ data: TrafficLog[] }> = ({ data }) => {
  if (data.length === 0) {
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
            <tr key={index}>
              <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
              <td>{item.endpoint}</td>
              <td>{item.method}</td>
              <td>{item.headers && item.headers["x-forwarded-for"] || item.ip}</td>
              <td>{item.statusCode || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <style jsx>{`
        .traffic-table {
          width: 100%;
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        tr:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [timeWindow, setTimeWindow] = useState<number>(5);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`/api/traffic/combined?timeWindow=${timeWindow}`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setDashboardData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };
    
    // Initial fetch
    fetchDashboardData();
    
    // Set up polling at 5-second intervals
    const intervalId = setInterval(fetchDashboardData, 5000);
    
    return () => clearInterval(intervalId);
  }, [timeWindow]);
  
  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }
  
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Traffic Dashboard</h1>
        <div className="time-filter">
          <label htmlFor="timeWindow">Time Window:</label>
          <select 
            id="timeWindow" 
            value={timeWindow} 
            onChange={(e) => setTimeWindow(Number(e.target.value))}
          >
            <option value={1}>Last 1 minute</option>
            <option value={5}>Last 5 minutes</option>
            <option value={15}>Last 15 minutes</option>
            <option value={30}>Last 30 minutes</option>
          </select>
        </div>
      </div>
      
      <div className="charts-container">
        <div className="chart-section">
          <h2>Login Endpoint</h2>
          <TrafficChart 
            data={dashboardData?.login || []} 
            endpoint="/api/auth/login" 
            timeWindow={timeWindow} 
          />
        </div>
        
        <div className="chart-section">
          <h2>Checkout Endpoint</h2>
          <TrafficChart 
            data={dashboardData?.checkout || []} 
            endpoint="/api/checkout" 
            timeWindow={timeWindow} 
          />
        </div>
      </div>
      
      <div className="recent-traffic">
        <h2>Recent Requests</h2>
        <RecentTrafficTable data={dashboardData?.recent || []} />
      </div>
      
      <style jsx>{`
        .dashboard {
          padding: 20px;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .time-filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .time-filter select {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        .charts-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        
        @media (min-width: 768px) {
          .charts-container {
            grid-template-columns: 1fr 1fr;
          }
        }
        
        .chart-section {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .chart-section h2 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
          color: #333;
        }
        
        .recent-traffic {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .recent-traffic h2 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
          color: #333;
        }
        
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;