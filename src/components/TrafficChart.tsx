// src/components/TrafficChart.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  
  // Store a reference to the processed data to prevent double-counting
  const processedDataRef = useRef<Set<string>>(new Set());
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Process data to prevent double-counting
  const processedData = useMemo(() => {
    // Get unique logs based on timestamp+endpoint combination
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

  // Generate chart data with fixed time interval x-axis
  const chartData = useMemo(() => {
    // Number of time slots (buckets) - 6 per minute (10-second intervals)
    const numSlots = timeWindow * 6;
    
    // Calculate time window boundaries
    const endTime = new Date(currentTime);
    const startTime = new Date(endTime);
    startTime.setMinutes(startTime.getMinutes() - timeWindow);
    
    // Create consistent time buckets every 10 seconds
    const buckets: number[] = Array(numSlots).fill(0);
    const bucketLabels: string[] = [];
    const bucketTimestamps: Date[] = [];
    
    // Calculate bucket timestamps
    for (let i = 0; i < numSlots; i++) {
      const slotTime = new Date(startTime);
      slotTime.setSeconds(slotTime.getSeconds() + (i * 10));
      bucketTimestamps.push(slotTime);
      
      // Format nicely as "HH:MM:SS"
      const hours = slotTime.getHours().toString().padStart(2, '0');
      const minutes = slotTime.getMinutes().toString().padStart(2, '0');
      const seconds = slotTime.getSeconds().toString().padStart(2, '0');
      
      // Only show minutes and seconds for readability
      bucketLabels.push(`${minutes}:${seconds}`);
    }
    
    // Place data points in the appropriate buckets
    processedData.forEach(log => {
      const logTime = new Date(log.timestamp);
      
      // Skip if outside our time window
      if (logTime < startTime || logTime > endTime) return;
      
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
  
  // Calculate total requests and last 10 seconds count
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
  
  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          // Display fewer labels for readability
          callback: function(val: number, index: number) {
            // Show every 3rd label (30 second intervals)
            return index % 3 === 0 ? this.getLabelForValue(val) : '';
          }
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Request Count',
        },
        suggestedMin: 0,
      },
    },
    plugins: {
      title: {
        display: true,
        text: `Traffic to ${endpoint}`,
        font: {
          size: 16,
        },
      },
      legend: {
        display: true,
      },
      // Custom tooltip
      tooltip: {
        callbacks: {
          title: function(context: Array<{label: string}>) {
            // The x value (time)
            return `Time: ${context[0].label}`;
          }
        }
      }
    },
    animation: {
      duration: 0, // Disable animation for better performance
    },
  };
  
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Response Codes',
        font: {
          size: 16,
        },
      },
      legend: {
        display: false,
      },
    },
  };
  
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
          <Line data={chartData} options={lineChartOptions} height={300} />
        ) : (
          <Bar data={responseCodeData} options={barChartOptions} height={300} />
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