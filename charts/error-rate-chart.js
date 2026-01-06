/**
 * Error Rate Chart Web Component
 * Displays hourly error counts as an interactive bar chart
 * Emits 'hour-selected' event when a bar is clicked
 */
import { Chart, registerables } from 'chartjs';
import { dayNightPlugin } from './day-night-plugin.js';

// Register Chart.js components
Chart.register(...registerables);

class ErrorRateChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
    this.chartData = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .chart-wrapper {
          width: 100%;
        }

        .chart-instructions {
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 16px;
          padding: 8px;
          background: #f9fafb;
          border-radius: 4px;
        }

        .timezone-note {
          text-align: center;
          color: #9ca3af;
          font-size: 0.75rem;
          margin-bottom: 12px;
          font-style: italic;
        }

        .chart-container {
          position: relative;
          width: 100%;
          height: 400px;
          margin-bottom: 24px;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .chart-container {
            height: 300px;
          }
        }
      </style>

      <div class="chart-wrapper">
        <div class="chart-instructions">
          Click on any point to view detailed error breakdown for that hour
        </div>

        <div class="timezone-note">
          All times displayed in your local timezone (UTC${this.getTimezoneOffset()})
        </div>

        <div class="chart-container">
          <canvas id="error-chart"></canvas>
        </div>
      </div>
    `;
  }

  setData(hourFacets) {
    if (!hourFacets || hourFacets.length === 0) {
      this.showNoData();
      return;
    }

    // Ensure canvas exists (may have been removed by showNoData)
    this.ensureCanvas();
    this.renderChart(hourFacets);
  }

  ensureCanvas() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    
    let canvas = this.shadowRoot.getElementById('error-chart');
    if (!canvas) {
      container.innerHTML = '<canvas id="error-chart"></canvas>';
    }
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    container.innerHTML = '<div class="no-data">No data available</div>';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  renderChart(hourFacets) {
    // Sort by hour (timeSlot)
    const sortedHours = [...hourFacets].sort((a, b) =>
      new Date(a.value).getTime() - new Date(b.value).getTime()
    );

    const chartData = sortedHours.map(facet => {
      const errorCount = facet.metrics.errorCount?.sum || 0;
      const pageViews = facet.metrics.pageViews?.sum || 0;
      const errorRate = pageViews > 0 ? (errorCount / pageViews) * 100 : 0;

      return {
        hour: this.formatHour(facet.value),
        rawHour: facet.value,
        errorCount,
        pageViews,
        errorRate,
        facet
      };
    });

    const canvas = this.shadowRoot.getElementById('error-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.hour),
        datasets: [{
          label: 'Error Rate',
          data: chartData.map(d => d.errorRate),
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 2,
          pointBackgroundColor: chartData.map(d => this.getBarColorByRate(d.errorRate)),
          pointBorderColor: chartData.map(d => this.getBarColorByRate(d.errorRate, 1)),
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3
        }]
      },
      plugins: [dayNightPlugin], // Register plugin locally for this chart only
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            this.emitHourSelected(chartData[index]);
          }
        },
        plugins: {
          dayNightBackground: {
            enabled: true,
            dayStart: 6,
            dayEnd: 20,
            nightColor: 'rgba(30, 41, 59, 0.08)',
            showLegend: true,
            rawHourData: chartData.map(d => d.rawHour)
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = chartData[context.dataIndex];
                return [
                  `Error Rate: ${data.errorRate.toFixed(2)}%`,
                  `Errors: ${data.errorCount}`,
                  `Page Views: ${data.pageViews}`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Error Rate Per Hour',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Error Rate (%)'
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(1) + '%';
              }
            }
          },
          x: {
            title: {
              display: true,
              text: 'Hour'
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        }
      }
    });

    // Store chart data for later use
    this.chartData = chartData;
  }

  emitHourSelected(hourData) {
    const event = new CustomEvent('hour-selected', {
      detail: hourData,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  getBarColor(errorCount, alpha = 0.6) {
    // Color gradient based on error count (kept for backward compatibility)
    if (errorCount === 0) {
      return `rgba(34, 197, 94, ${alpha})`; // green
    } else if (errorCount < 5) {
      return `rgba(234, 179, 8, ${alpha})`; // yellow
    } else if (errorCount < 10) {
      return `rgba(249, 115, 22, ${alpha})`; // orange
    } else {
      return `rgba(239, 68, 68, ${alpha})`; // red
    }
  }

  getBarColorByRate(errorRate, alpha = 0.6) {
    // Color gradient based on error rate percentage
    if (errorRate === 0) {
      return `rgba(34, 197, 94, ${alpha})`; // green - no errors
    } else if (errorRate < 1) {
      return `rgba(234, 179, 8, ${alpha})`; // yellow - < 1% error rate
    } else if (errorRate < 5) {
      return `rgba(249, 115, 22, ${alpha})`; // orange - 1-5% error rate
    } else {
      return `rgba(239, 68, 68, ${alpha})`; // red - > 5% error rate
    }
  }

  formatHour(timeSlot) {
    // timeSlot is already in local timezone format from the facet
    // Parse it as a local time string (without 'Z' so it's not treated as UTC)
    const date = new Date(timeSlot);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${month}/${day} ${hour}:00`;
  }

  getTimezoneOffset() {
    const offset = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  reset() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.chartData = null;
  }
}

// Define the custom element
customElements.define('error-rate-chart', ErrorRateChart);

export default ErrorRateChart;

