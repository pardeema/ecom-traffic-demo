// src/components/TrafficChart.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Create a fixed array of time slots (one per 10 seconds)
  const timeSlots = useMemo(() => {
    // Number of slots (6 per minute = 1 per 10 seconds)
    const slotCount = timeWindow * 6;
    return Array.from({ length: slotCount }, (_, i) => i);
  }, [timeWindow]);

  // Generate labels for the chart (counting backward from now)
  const generateLabels = useCallback(() => {
    return timeSlots.map(slot => {
      const slotTime = new Date(currentTime.getTime() - (slot * 10 * 1000));
      return slotTime.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
    }).reverse(); // Reverse to show oldest first (left to right)
  }, [currentTime, timeSlots]);

  // Count data points that fall into each time slot
  const generateDataPoints = useCallback(() => {
    // Filter out data points older than our time window
    const cutoffTime = new Date(currentTime.getTime() - (timeWindow * 60 * 1000));
    const recentData = data.filter(item => new Date(item.timestamp) >= cutoffTime);

    // Initialize counts for all slots to 0
    const counts = Array(timeSlots.length).fill(0);

    // Count items in each slot
    recentData.forEach(item => {
      const itemTime = new Date(item.timestamp);
      const secondsAgo = Math.floor((currentTime.getTime() - itemTime.getTime()) / 1000);
      const slotIndex = Math.floor(secondsAgo / 10);
      
      // Only count if it falls within our window
      if (slotIndex >= 0 && slotIndex < timeSlots.length) {
        counts[slotIndex]++;
      }
    });

    return counts.reverse(); // Reverse to match the order of labels
  }, [currentTime, data, timeSlots, timeWindow]);

  // Prepare time series chart data
  const timeSeriesData = useMemo(() => {
    return {
      labels: generateLabels(),
      datasets: [
        {
          label: 'Requests',
          data: generateDataPoints(),
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.4,
        },
      ],
    };
  }, [generateLabels, generateDataPoints]);

  // Prepare response code data
  const responseCodeData = useMemo(() => {
    const responseCodes: { [key: string]: number } = {};
    
    // Count occurrences of each status code
    data.forEach(item => {
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
  }, [data]);
  
  // Line chart options
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
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Request Count',
        },
        suggestedMin: 0,
        suggestedMax: 5
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
      tooltip: {
        callbacks: {
          title: function(tooltipItems: Array<{label: string}>) {
            return `Time: ${tooltipItems[0].label}`;
          },
          label: function(context: {raw: number}) {
            return `Requests: ${context.raw}`;
          }
        }
      }
    },
    animation: {
      duration: 0, // Disable animation for better performance
    },
  };
  
  // Bar chart options
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

  // Calculate "Last 10 seconds" count
  const last10SecondsCount = useMemo(() => {
    const tenSecondsAgo = new Date(currentTime.getTime() - 10000);
    return data.filter(item => new Date(item.timestamp) >= tenSecondsAgo).length;
  }, [currentTime, data]);
  
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
          <Line data={timeSeriesData} options={lineChartOptions} height={300} />
        ) : (
          <Bar data={responseCodeData} options={barChartOptions} height={300} />
        )}
      </div>
      
      <div className="traffic-stats">
        <div className="stat-item">
          <span className="stat-label">Total Requests:</span>
          <span className="stat-value">{data.length}</span>
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