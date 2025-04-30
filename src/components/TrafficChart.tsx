// src/components/TrafficChart.tsx
import { useState, useEffect, useRef } from 'react';
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
  labels: string[];
  data: number[];
  endpoint: string;
  lastMinuteCount: number;
  lastTenSecondsCount: number;
}

const TrafficChart: React.FC<TrafficChartProps> = ({
  labels,
  data,
  endpoint,
  lastMinuteCount,
  lastTenSecondsCount
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const chartRef = useRef<any>(null);
  
  // Create chart data from props
  const chartData = {
    labels,
    datasets: [{
      label: 'Requests',
      data,
      fill: true,
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      tension: 0.4,
    }]
  };
  
  // Update chart with smooth animation when data changes
  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current;
      
      // Check if data has changed and update the chart
      if (chart.data.labels.length !== labels.length ||
          JSON.stringify(chart.data.datasets[0].data) !== JSON.stringify(data)) {
        
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update('none'); // Update without animation for smoother real-time feel
      }
    }
  }, [labels, data]);
  
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
          Bar Chart
        </button>
      </div>
      
      <div className="chart-container">
        {chartType === 'line' ? (
          <Line 
            ref={chartRef}
            data={chartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  suggestedMax: Math.max(...data) > 0 ? Math.max(...data) + 1 : 2
                }
              },
              animation: {
                duration: 0 // Disable animation for smoother real-time updates
              },
              plugins: {
                tooltip: {
                  mode: 'index',
                  intersect: false,
                },
                legend: {
                  display: false
                }
              }
            }} 
            height={300} 
          />
        ) : (
          <Bar 
            ref={chartRef}
            data={chartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  suggestedMax: Math.max(...data) > 0 ? Math.max(...data) + 1 : 2
                }
              },
              animation: {
                duration: 0
              },
              plugins: {
                legend: {
                  display: false
                }
              }
            }} 
            height={300} 
          />
        )}
      </div>
      
      <div className="traffic-stats">
        <div className="stat-item">
          <span className="stat-label">Last Minute:</span>
          <span className="stat-value">{lastMinuteCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last 10 seconds:</span>
          <span className="stat-value">{lastTenSecondsCount}</span>
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
          position: relative;
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