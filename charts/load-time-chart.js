/**
 * Load Time Chart Web Component
 * Displays hourly average form block load times as an interactive line chart
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class LoadTimeChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
    this.chartData = null;
    this.selectedPercentile = 'p50'; // default to p50
  }

  static get observedAttributes() {
    return ['percentile'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'percentile' && oldValue !== newValue) {
      this.selectedPercentile = newValue || 'p50';
      if (this.chartData) {
        // Re-render chart with new percentile
        this.updateChartData();
      }
    }
  }

  connectedCallback() {
    this.selectedPercentile = this.getAttribute('percentile') || 'p50';
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

        .chart-instructions strong {
          color: #374151;
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
        <div class="chart-instructions" id="chart-instructions">
          Click on <strong>p50</strong> or <strong>p75</strong> stat cards above to view that percentile
        </div>

        <div class="timezone-note">
          All times displayed in your local timezone (UTC${this.getTimezoneOffset()})
        </div>

        <div class="chart-container">
          <canvas id="load-time-chart"></canvas>
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
      const p50LoadTime = facet.metrics.formBlockLoadTime?.percentile(50) || 0;
      const p75LoadTime = facet.metrics.formBlockLoadTime?.percentile(75) || 0;
      const pageViews = facet.metrics.pageViews?.sum || 0;
      const minLoadTime = facet.metrics.formBlockLoadTime?.min || 0;

      return {
        hour: this.formatHour(facet.value),
        rawHour: facet.value,
        p50LoadTime,
        p75LoadTime,
        pageViews,
        minLoadTime,
        facet
      };
    });

    const canvas = this.shadowRoot.getElementById('load-time-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Create datasets based on selected percentile
    const datasets = this.getDatasets(chartData);

    // Create new chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.hour),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              afterLabel: (context) => {
                if (context.datasetIndex === 0) { // Only show once
                  const data = chartData[context.dataIndex];
                  return [
                    '',
                    `Page Views: ${data.pageViews}`,
                    `Min: ${this.formatTime(data.minLoadTime)}`
                  ];
                }
                return '';
              }
            }
          },
          title: {
            display: true,
            text: 'Engagement Readiness Time (Form Visibility) Percentiles Per Hour',
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
              text: 'Load Time (seconds)'
            },
            ticks: {
              callback: (value) => this.formatTime(value)
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
          intersect: false
        }
      }
    });

    // Store chart data for later use
    this.chartData = chartData;
  }

  getDatasets(chartData) {
    if (this.selectedPercentile === 'p75') {
      return [{
        label: 'p75 (75th percentile)',
        data: chartData.map(d => d.p75LoadTime),
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.8)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: chartData.map(d => this.getPointColor(d.p75LoadTime)),
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }];
    } else {
      // Default to p50
      return [{
        label: 'p50 (Median)',
        data: chartData.map(d => d.p50LoadTime),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: chartData.map(d => this.getPointColor(d.p50LoadTime)),
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }];
    }
  }

  updateChartData() {
    if (!this.chart || !this.chartData) return;

    // Update datasets
    this.chart.data.datasets = this.getDatasets(this.chartData);

    // Update title
    const percentileLabel = this.selectedPercentile === 'p75' ? 'p75 (75th Percentile)' : 'p50 (Median)';
    this.chart.options.plugins.title.text = `Form Block Load Time - ${percentileLabel} Per Hour`;

    this.chart.update();
  }

  getPointColor(loadTime) {
    // Color gradient based on load time (in seconds)
    // Green for fast, yellow for moderate, orange for slow, red for very slow
    if (loadTime <= 1) {
      return 'rgba(34, 197, 94, 1)'; // green - fast
    } else if (loadTime <= 2) {
      return 'rgba(234, 179, 8, 1)'; // yellow - moderate
    } else if (loadTime <= 3) {
      return 'rgba(249, 115, 22, 1)'; // orange - slow
    } else {
      return 'rgba(239, 68, 68, 1)'; // red - very slow
    }
  }

  formatTime(seconds) {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
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
customElements.define('load-time-chart', LoadTimeChart);

export default LoadTimeChart;

