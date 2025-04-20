// src/components/TrafficChart.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrafficLog } from '@/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TrafficChartProps {
  data: TrafficLog[];
  endpoint: string;
  timeWindow: number; // in minutes
}

const TrafficChart: React.FC<TrafficChartProps> = ({ data, endpoint, timeWindow }) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Process data to prevent double-counting and ensure we have unique logs
  const processedData = useMemo(() => {
    const uniqueLogs: TrafficLog[] = [];
    const seenKeys = new Set<string>();
    
    data.forEach(log => {
      const key = `${log.timestamp}-${log.endpoint}-${log.method}-${log.statusCode}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueLogs.push(log);
      }
    });
    
    return uniqueLogs;
  }, [data]);

  // Generate chart data
  const chartData = useMemo(() => {
    // Calculate time window boundaries
    const endTime = new Date(currentTime);
    const startTime = new Date(endTime);
    startTime.setMinutes(startTime.getMinutes() - timeWindow);
    
    // Number of time slots (buckets) - 6 per minute (10-second intervals)
    const numSlots = timeWindow * 6;
    
    // Create time buckets every 10 seconds
    const buckets: number[] = Array(numSlots).fill(0);
    const bucketLabels: string[] = [];
    const bucketTimestamps: Date[] = [];
    
    // Calculate bucket timestamps and labels
    for (let i = 0; i < numSlots; i++) {
      const slotTime = new Date(startTime);
      slotTime.setSeconds(slotTime.getSeconds() + (i * 10));
      bucketTimestamps.push(slotTime);
      
      // Format as "MM:SS"
      const minutes = slotTime.getMinutes().toString().padStart(2, '0');
      const seconds = slotTime.getSeconds().toString().padStart(2, '0');
      bucketLabels.push(`${minutes}:${seconds}`);
    }
    
    // Filter data to only include items within the time window
    const recentLogs = processedData.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= startTime && logTime <= endTime;
    });
    
    // Place logs into appropriate buckets
    recentLogs.forEach(log => {
      const logTime = new Date(log.timestamp);
      
      // Find which bucket this timestamp belongs to
      for (let i = 0; i < numSlots - 1; i++) {
        if (logTime >= bucketTimestamps[i] && logTime < bucketTimestamps[i + 1]) {
          buckets[i]++;
          break;
        }
      }
      
      // Handle the last bucket separately
      if (logTime >= bucketTimestamps[numSlots - 1] && logTime <= endTime) {
        buckets[numSlots - 1]++;
      }
    });
    
    return {
      labels: bucketLabels,
      datasets: [{
        label: 'Requests',
        data: buckets,
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.4,
      }]
    };
  }, [currentTime, processedData, timeWindow]);

  // Prepare response code data
  const responseCodeData = useMemo(() => {
    // Filter to only show data within the time window
    const endTime = currentTime.getTime();
    const startTime = endTime - (timeWindow * 60 * 1000);
    
    const recentLogs = processedData.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= startTime && logTime <= endTime;
    });
    
    const responseCodes: { [key: string]: number } = {};
    
    // Count occurrences of each status code
    recentLogs.forEach(item => {
      const code = item.statusCode?.toString() || 'unknown';
      responseCodes[code] = (responseCodes[code] || 0) + 1;
    });
    
    return {
      labels: Object.keys(responseCodes),
      datasets: [
        {
          label: 'Response Codes',
          data: Object.values(responseCodes),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 205, 86, 0.6)',
            'rgba(54, 162, 235, 0.6)',
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 205, 86, 1)',
            'rgba(54, 162, 235, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [currentTime, processedData, timeWindow]);
  
  // Calculate totals
  const totalRequests = useMemo(() => {
    // Count total requests within the time window
    const endTime = currentTime.getTime();
    const startTime = endTime - (timeWindow * 60 * 1000);
    
    return processedData.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= startTime && logTime <= endTime;
    }).length;
  }, [currentTime, processedData, timeWindow]);
  
  const last10SecondsCount = useMemo(() => {
    const tenSecondsAgo = currentTime.getTime() - 10000;
    
    return processedData.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= tenSecondsAgo;
    }).length;
  }, [currentTime, processedData]);
  
  return (
    <div className="traffic-chart">
      <div className="chart-controls">
        <button 
          onClick={() => setChartType('line')}
          className={chartType === 'line' ? 'active' : ''}
        >
          Time Series
        </button>
        <button 
          onClick={() => setChartType('bar')}
          className={chartType === 'bar' ? 'active' : ''}
        >
          Response Codes
        </button>
      </div>
      
      <div className="chart-container">
        {chartType === 'line' ? (
          <Line 
            data={chartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 0
              }
            }} 
            height={300} 
          />
        ) : (
          <Bar 
            data={responseCodeData} 
            options={{
              responsive: true,
              maintainAspectRatio: false
            }} 
            height={300} 
          />
        )}
      </div>
      
      <div className="traffic-stats">
        <div className="stat-item">
          <span className="stat-label">Total Requests:</span>
          <span className="stat-value">{totalRequests}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last 10 seconds:</span>
          <span className="stat-value">{last10SecondsCount}</span>
        </div>
      </div>
      
      <style jsx>{`
        .traffic-chart {
          margin-bottom: 30px;
        }
        
        .chart-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .chart-controls button {
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .chart-controls button.active {
          background: #0070f3;
          color: white;
          border-color: #0070f3;
        }
        
        .chart-container {
          height: 300px;
          margin-bottom: 15px;
        }
        
        .traffic-stats {
          display: flex;
          gap: 20px;
        }
        
        .stat-item {
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          flex: 1;
        }
        
        .stat-label {
          font-weight: bold;
          margin-right: 5px;
        }
        
        .stat-value {
          font-size: 18px;
          color: #0070f3;
        }
      `}</style>
    </div>
  );
};

export default TrafficChart;