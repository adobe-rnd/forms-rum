/**
 * Error Rate Chart Web Component
 * Displays hourly error counts as an interactive bar chart
 * Emits 'hour-selected' event when a bar is clicked
 */
import { Chart, registerables } from 'chartjs';

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
          Click on any hour bar to view detailed error breakdown
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

    this.renderChart(hourFacets);
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
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
      type: 'bar',
      data: {
        labels: chartData.map(d => d.hour),
        datasets: [{
          label: 'Error Count',
          data: chartData.map(d => d.errorCount),
          backgroundColor: chartData.map(d => this.getBarColor(d.errorCount)),
          borderColor: chartData.map(d => this.getBarColor(d.errorCount, 0.8)),
          borderWidth: 1
        }]
      },
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
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = chartData[context.dataIndex];
                return [
                  `Errors: ${data.errorCount}`,
                  `Page Views: ${data.pageViews}`,
                  `Error Rate: ${data.errorRate.toFixed(2)}%`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Errors Per Hour',
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
              text: 'Error Count'
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
          mode: 'nearest',
          intersect: true
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
    // Color gradient based on error count
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

