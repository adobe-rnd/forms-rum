import { Chart, registerables } from 'chartjs';
import 'chartjs-adapter-luxon';

Chart.register(...registerables);

/**
 * ErrorRateChart Web Component
 * Displays error rate per hour as a line chart using Chart.js
 */
class ErrorRateChart extends HTMLElement {
  constructor() {
    super();
    this.chart = null;
    this.data = [];
  }

  connectedCallback() {
    // Create canvas element for chart
    this.innerHTML = '<canvas id="error-rate-canvas"></canvas>';
    this.canvas = this.querySelector('#error-rate-canvas');

    // Initialize chart if data is already set
    if (this.data.length > 0) {
      this.renderChart();
    }
  }

  disconnectedCallback() {
    // Cleanup chart when component is removed
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Set chart data and render
   * @param {Array} hourlyData - Array of objects with {hour, errorRate, totalErrors, totalPageViews}
   */
  setData(hourlyData) {
    this.data = hourlyData;
    if (this.canvas) {
      this.renderChart();
    }
  }

  /**
   * Calculate error rate from filtered bundles grouped by hour
   * @param {Array} filteredBundles - Array of hourly chunks with filtered bundles
   * @returns {Array} Array of {hour, errorRate, totalErrors, totalPageViews}
   */
  static calculateErrorRate(filteredBundles) {
    const hourlyStats = [];

    filteredBundles.forEach((chunk) => {
      const bundles = chunk.rumBundles || chunk;

      if (!Array.isArray(bundles) || bundles.length === 0) {
        return;
      }

      // Get the hour from the first bundle
      const hour = bundles[0]?.timeSlot || chunk.date;

      // Calculate weighted totals
      let totalPageViews = 0;
      let totalErrors = 0;

      bundles.forEach((bundle) => {
        const weight = bundle.weight || 1;
        totalPageViews += weight;

        // Check if bundle has error events
        const hasError = bundle.events?.some(event => event.checkpoint === 'error');
        if (hasError) {
          totalErrors += weight;
        }
      });

      const errorRate = totalPageViews > 0 ? (totalErrors / totalPageViews) * 100 : 0;

      hourlyStats.push({
        hour,
        errorRate,
        totalErrors,
        totalPageViews,
      });
    });

    // Sort by hour
    hourlyStats.sort((a, b) => new Date(a.hour) - new Date(b.hour));

    return hourlyStats;
  }

  renderChart() {
    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.canvas.getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.data.map(d => d.hour),
        datasets: [{
          label: 'Error Rate (%)',
          data: this.data.map(d => d.errorRate),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'MMM dd, HH:mm'
              },
              tooltipFormat: 'MMM dd, yyyy HH:mm'
            },
            title: {
              display: true,
              text: 'Time (Hour)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Error Rate (%)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(2) + '%';
              }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Error Rate Per Hour',
            font: {
              size: 18,
              weight: 'bold'
            },
            padding: 20
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const dataPoint = this.data[context.dataIndex];
                return [
                  `Error Rate: ${dataPoint.errorRate.toFixed(2)}%`,
                  `Total Errors: ${dataPoint.totalErrors}`,
                  `Total Page Views: ${dataPoint.totalPageViews}`
                ];
              }
            }
          },
          legend: {
            display: true,
            position: 'top',
          }
        }
      }
    });
  }
}

// Define the custom element
customElements.define('error-rate-chart', ErrorRateChart);

export default ErrorRateChart;

