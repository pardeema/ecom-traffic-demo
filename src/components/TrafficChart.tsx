// src/components/TrafficChart.tsx
import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Keep BarElement if needed later, but not used currently
  Title,
  Tooltip,
  Legend,
  TimeScale, // Import TimeScale
  TimeSeriesScale // Import TimeSeriesScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns'; // Import date adapter

// Register Chart.js components including time scales
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // BarElement, // Not used for time series
  Title,
  Tooltip,
  Legend,
  TimeScale,        // Register TimeScale
  TimeSeriesScale   // Register TimeSeriesScale
);

// New interface for aggregated data points passed as props
interface AggregatedDataPoint {
    timestamp: number; // Unix timestamp (seconds)
    count: number;
}

interface TrafficChartProps {
  aggregatedData: AggregatedDataPoint[];
  label: string; // e.g., "Logins" or "Checkouts"
}

const TrafficChart: React.FC<TrafficChartProps> = ({ aggregatedData, label }) => {

  // Process aggregated data for the chart
  const chartData = useMemo(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
        // Return empty structure if no data
        return { labels: [], datasets: [] };
    }

    // Convert timestamps (seconds) to milliseconds for chart.js
    const labels = aggregatedData.map(d => d.timestamp * 1000);
    const dataPoints = aggregatedData.map(d => d.count);

    // Find the min and max timestamp for setting scale bounds
    const timestamps = aggregatedData.map(d => d.timestamp * 1000);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    return {
      // labels: labels, // Use timestamps directly on x-axis for TimeScale
      datasets: [{
        label: label, // Use the passed label
        // Data format for TimeScale: { x: timestamp, y: value }
        data: aggregatedData.map(d => ({ x: d.timestamp * 1000, y: d.count })),
        fill: true,
        backgroundColor: label === 'Logins' ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 159, 64, 0.2)',
        borderColor: label === 'Logins' ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 159, 64, 1)',
        tension: 0.1, // Less tension for potentially fewer points
        pointRadius: 2, // Smaller points
        pointHoverRadius: 4,
      }]
    };
  }, [aggregatedData, label]);

  // Chart options using TimeScale
  const chartOptions = useMemo(() => {
     // Determine min/max from data, fallback if empty
    const timestamps = aggregatedData.map(d => d.timestamp * 1000);
    const minTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now() - 600000; // Fallback: 10 min ago
    const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();         // Fallback: now

     return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time' as const, // Specify the scale type
            time: {
              unit: 'minute' as const, // Display unit
              tooltipFormat: 'PPpp', // Format for tooltips (e.g., Apr 30, 2025, 3:45:00 PM)
              displayFormats: {
                minute: 'HH:mm', // Display format on the axis
                second: 'HH:mm:ss' // Add if using second-level granularity
              },
            },
            title: {
              display: true,
              text: 'Time',
            },
            min: minTimestamp, // Set bounds based on data
            max: maxTimestamp,
          },
          y: {
            beginAtZero: true,
            min: 0,
            suggestedMax: Math.max(5, ...aggregatedData.map(d => d.count)) + 1, // Dynamic suggested max
            title: {
              display: true,
              text: 'Count',
            },
          }
        },
        animation: {
            duration: 250 // Shorter animation for faster updates
        },
         plugins: {
            legend: {
              position: 'top' as const,
            },
             tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
          },
           hover: {
            mode: 'nearest' as const,
            intersect: true
          },
     }
  }, [aggregatedData]);


  return (
    <div className="traffic-chart-container">
      {/* Remove chart type controls and stats derived from raw logs */}
      <div className="chart-wrapper">
        <Line
          data={chartData}
          options={chartOptions}
          height={250} // Adjust height as needed
        />
      </div>
      {/* Removed traffic-stats section */}
      <style jsx>{`
        .traffic-chart-container {
          /* Add styling if needed */
        }
        .chart-wrapper {
          height: 250px; /* Ensure wrapper has height */
          position: relative; /* Needed for chart.js responsiveness */
        }
      `}</style>
    </div>
  );
};

export default TrafficChart;