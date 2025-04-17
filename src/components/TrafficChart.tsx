// src/components/TrafficChart.tsx
import { useState } from 'react';
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
  data: TrafficLog[]; // Now accepting data directly
  endpoint: string;
  timeWindow: number;
}

const TrafficChart: React.FC<TrafficChartProps> = ({ data, endpoint, timeWindow }) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  
  // Prepare time series data
  const prepareTimeSeriesData = () => {
    // Create time buckets (every 10 seconds within the time window)
    const now = new Date();
    const timeBuckets: Date[] = [];
    for (let i = timeWindow * 6; i >= 0; i--) {
      const bucketTime = new Date(now);
      bucketTime.setSeconds(bucketTime.getSeconds() - i * 10);
      timeBuckets.push(bucketTime);
    }
    
    // Count requests in each bucket
    const requestCounts = timeBuckets.map(bucketTime => {
      const bucketEnd = new Date(bucketTime);
      bucketEnd.setSeconds(bucketEnd.getSeconds() + 10);
      
      return data.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime >= bucketTime && itemTime < bucketEnd;
      }).length;
    });
    
    // Format labels (show only minute:second)
    const labels = timeBuckets.map(time => 
      time.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
    );
    
    return {
      labels,
      datasets: [
        {
          label: 'Requests',
          data: requestCounts,
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.4,
        },
      ],
    };
  };
  
  // Prepare response code data
  const prepareResponseCodeData = () => {
    const responseCodes: { [key: string]: number } = {};
    
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
  };
  
  const timeSeriesData = prepareTimeSeriesData();
  const responseCodeData = prepareResponseCodeData();
  
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
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Request Count',
        },
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
          <span className="stat-value">
            {data.filter(item => {
              const itemTime = new Date(item.timestamp);
              const tenSecondsAgo = new Date();
              tenSecondsAgo.setSeconds(tenSecondsAgo.getSeconds() - 10);
              return itemTime >= tenSecondsAgo;
            }).length}
          </span>
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