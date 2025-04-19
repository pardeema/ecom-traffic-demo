import React, { useState, useMemo } from 'react';
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
  ChartData,
  ChartOptions,
  TooltipItem,
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

// --- Types ---
// Define the structure of a single traffic log entry
// (You might want to move this to a central types file, e.g., src/types.ts)
export interface TrafficLog {
  id: string;
  timestamp: string; // ISO 8601 format string
  endpoint: string;
  statusCode: number | null;
  responseTime: number; // in milliseconds
}

// --- TrafficChart Component ---
interface TrafficChartProps {
  data: TrafficLog[]; // Data is passed directly from the parent
  endpoint: string; // Used for the chart title
  timeWindow: number; // Time window in minutes
}

const TrafficChart: React.FC<TrafficChartProps> = ({ data, endpoint, timeWindow }) => {
  // State to toggle between chart types
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // --- Memoized Data Preparation ---

  // Memoize time series data calculation to avoid recomputing on every render
  const timeSeriesData = useMemo(() => {
    console.log("Recalculating time series data..."); // Log to see when it runs
    // Create time buckets (every 10 seconds within the time window)
    const now = new Date();
    const buckets: { time: Date; count: number }[] = [];
    const bucketIntervalSeconds = 10;
    // Ensure at least one bucket even for very small time windows
    const totalBuckets = Math.max(1, Math.floor((timeWindow * 60) / bucketIntervalSeconds));


    // Initialize buckets going back in time
    for (let i = totalBuckets; i >= 0; i--) {
      const bucketStartTime = new Date(now);
      bucketStartTime.setSeconds(bucketStartTime.getSeconds() - i * bucketIntervalSeconds);
      bucketStartTime.setMilliseconds(0); // Align to the second
      buckets.push({ time: bucketStartTime, count: 0 });
    }

    // Assign data points to buckets
    data.forEach(item => {
      const itemTime = new Date(item.timestamp);
      // Find the correct bucket for the item by iterating backwards
      for (let i = buckets.length - 1; i >= 0; i--) {
         // Check if itemTime is within the bucket's start time and the next bucket's start time
         const bucketStartTime = buckets[i].time;
         const nextBucketStartTime = i + 1 < buckets.length ? buckets[i+1].time : new Date(now.getTime() + bucketIntervalSeconds * 1000); // Use a time in the future if it's the last bucket

        if (itemTime >= bucketStartTime && itemTime < nextBucketStartTime) {
           buckets[i].count++;
           break; // Stop searching once the bucket is found
        }
      }
    });

    // Format labels (show only minute:second)
    const labels = buckets.map(bucket =>
      bucket.time.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
    );
    const requestCounts = buckets.map(bucket => bucket.count);

    return {
      labels,
      datasets: [
        {
          label: 'Requests per 10s',
          data: requestCounts,
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.2)', // Tailwind blue-500
          borderColor: 'rgba(59, 130, 246, 1)',     // Tailwind blue-500
          tension: 0.3, // Smoother curve
          pointRadius: 2, // Smaller points
          pointHoverRadius: 5,
        },
      ],
    };
  }, [data, timeWindow]); // Recalculate only when data or timeWindow changes

  // Memoize response code data calculation
  const responseCodeData = useMemo(() => {
     console.log("Recalculating response code data..."); // Log to see when it runs
    const responseCodes: { [key: string]: number } = {};

    data.forEach(item => {
      const code = item.statusCode?.toString() || 'N/A'; // Handle null status codes
      responseCodes[code] = (responseCodes[code] || 0) + 1;
    });

    const labels = Object.keys(responseCodes);
    const counts = Object.values(responseCodes);

    // Generate colors based on status code ranges (example)
    const backgroundColors = labels.map(label => {
        const codeNum = parseInt(label, 10);
        if (isNaN(codeNum)) return 'rgba(156, 163, 175, 0.6)'; // Gray for N/A
        if (codeNum >= 200 && codeNum < 300) return 'rgba(34, 197, 94, 0.6)'; // Green-500
        if (codeNum >= 300 && codeNum < 400) return 'rgba(234, 179, 8, 0.6)'; // Yellow-500
        if (codeNum >= 400 && codeNum < 500) return 'rgba(249, 115, 22, 0.6)'; // Orange-500
        if (codeNum >= 500) return 'rgba(239, 68, 68, 0.6)'; // Red-500
        return 'rgba(107, 114, 128, 0.6)'; // Gray-500 for others
    });
     const borderColors = backgroundColors.map(color => color.replace('0.6', '1')); // Make border opaque

    return {
      labels,
      datasets: [
        {
          label: 'Response Codes',
          data: counts,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };
  }, [data]); // Recalculate only when data changes

  // --- Chart Options ---

  const commonOptions: Partial<ChartOptions> = {
      responsive: true,
      maintainAspectRatio: false, // Allow height control via container
      animation: {
        duration: 0, // Disable animation for real-time feel
      },
      plugins: {
        legend: {
            position: 'top' as const, // Position legend at the top
            labels: {
                boxWidth: 12,
                padding: 15,
                font: {
                    size: 12
                }
            }
        },
        tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 4,
            displayColors: true, // Show color box in tooltip
            callbacks: {
                // Customize tooltip label for both chart types
                label: function(context: TooltipItem<any>) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    // Use context.formattedValue for built-in formatting
                    // Use context.parsed.y for line/bar vertical value
                    // Use context.parsed.x for horizontal bar value
                    if (context.chart.config.type === 'bar' && context.parsed.x !== null) {
                         label += context.formattedValue;
                    } else if (context.chart.config.type === 'line' && context.parsed.y !== null) {
                         label += context.formattedValue;
                    }
                    return label;
                },
                 // Customize tooltip title (optional)
                 title: function(tooltipItems: TooltipItem<any>[]) {
                    // For line chart, show the time label
                    if (tooltipItems[0]?.chart.config.type === 'line') {
                        return `Time: ${tooltipItems[0].label}`;
                    }
                    // For bar chart, show the status code
                    if (tooltipItems[0]?.chart.config.type === 'bar') {
                        return `Status Code: ${tooltipItems[0].label}`;
                    }
                    return '';
                 }
            }
        }
      }
  };

  const lineChartOptions: ChartOptions<'line'> = {
    ...commonOptions,
    scales: {
      x: {
        title: {
          display: true,
          text: `Time (Last ${timeWindow} min)`,
          font: { size: 12 },
          padding: { top: 10 },
        },
        grid: {
            display: false // Hide vertical grid lines
        },
        ticks: {
            font: { size: 10 },
            maxRotation: 0, // Prevent label rotation
            autoSkip: true, // Automatically skip labels if too crowded
            maxTicksLimit: 10 // Limit the number of visible ticks
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Request Count',
          font: { size: 12 },
          padding: { bottom: 10 },
        },
        grid: {
            color: 'rgba(209, 213, 219, 0.5)' // Lighter grid lines (Tailwind gray-300)
        },
        ticks: {
            font: { size: 10 }
        }
      },
    },
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: true,
        text: `Traffic to ${endpoint}`,
        font: { size: 16, weight: 'bold' },
        padding: { bottom: 15 },
        align: 'start' as const,
      },
       legend: {
           ...(commonOptions.plugins?.legend || {}), // Ensure legend object exists
           display: true // Show legend for line chart
       }
    },
  };

  const barChartOptions: ChartOptions<'bar'> = {
      ...commonOptions,
      indexAxis: 'y' as const, // Horizontal bar chart for better label readability
      scales: {
          x: {
              beginAtZero: true,
              title: {
                  display: true,
                  text: 'Count',
                  font: { size: 12 },
                  padding: { top: 10 },
              },
              grid: {
                  color: 'rgba(209, 213, 219, 0.5)' // Lighter grid lines
              },
              ticks: {
                  font: { size: 10 }
              }
          },
          y: {
              title: {
                  display: true,
                  text: 'Status Code',
                  font: { size: 12 },
                  padding: { bottom: 10 },
              },
              grid: {
                  display: false // Hide horizontal grid lines
              },
              ticks: {
                  font: { size: 10 }
              }
          }
      },
      plugins: {
          ...commonOptions.plugins,
          title: {
              display: true,
              text: `Response Codes for ${endpoint}`,
              font: { size: 16, weight: 'bold' },
              padding: { bottom: 15 },
              align: 'start' as const,
          },
          legend: {
              ...(commonOptions.plugins?.legend || {}), // Ensure legend object exists
              display: false, // Hide legend for bar chart (colors are self-explanatory)
          },
      },
  };


  // --- Stats Calculation ---
  const totalRequests = data.length;
  // Get count from the most recent bucket in the time series data
  const requestsInLastBucket = timeSeriesData.datasets[0]?.data?.slice(-1)[0] ?? 0;

  // --- Render Logic ---
  return (
    // Using Tailwind classes for styling
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6 border border-gray-200">
        {/* Chart Type Toggle Buttons */}
        <div className="flex justify-end space-x-2 mb-4">
            <button
                onClick={() => setChartType('line')}
                aria-pressed={chartType === 'line'} // Accessibility
                className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${
                chartType === 'line'
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                Time Series
            </button>
            <button
                onClick={() => setChartType('bar')}
                aria-pressed={chartType === 'bar'} // Accessibility
                className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${
                chartType === 'bar'
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                Response Codes
            </button>
        </div>

        {/* Chart Container */}
        <div className="relative h-72 w-full mb-4"> {/* Fixed height container */}
            {data.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                    No data available for this period.
                 </div>
            ) : chartType === 'line' ? (
                // Ensure data types match Chart.js expectations
                <Line data={timeSeriesData as ChartData<'line', number[], string>} options={lineChartOptions} />
            ) : (
                <Bar data={responseCodeData as ChartData<'bar', number[], string>} options={barChartOptions} />
            )}
        </div>

        {/* Stats Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-center sm:text-left">
                <span className="block sm:inline font-medium text-gray-600">Total Requests (last {timeWindow} min):</span>
                <span className="block sm:inline ml-0 sm:ml-2 text-lg font-semibold text-blue-600">{totalRequests}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-center sm:text-left">
                <span className="block sm:inline font-medium text-gray-600">Requests (last 10s):</span>
                <span className="block sm:inline ml-0 sm:ml-2 text-lg font-semibold text-blue-600">{requestsInLastBucket}</span>
            </div>
        </div>
    </div>
  );
};

// Export TrafficChart as the default for this file (TrafficChart.tsx)
export default TrafficChart;
