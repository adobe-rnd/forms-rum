/**
 * Source Over Time Chart Web Component
 * Displays error count over time per source as a multi-line chart
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class SourceTimeChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
    this.maxSources = 8; // Limit number of sources to display
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

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .chart-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .chart-subtitle {
          font-size: 0.75rem;
          color: #6b7280;
          font-style: italic;
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
          height: 350px;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        .legend-info {
          margin-top: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .chart-container {
            height: 280px;
          }
        }
      </style>

      <div class="chart-wrapper">
        <div class="chart-header">
          <span class="chart-title">Source Over Time</span>
          <span class="chart-subtitle">Error count by source per hour</span>
        </div>
        <div class="timezone-note">
          All times displayed in your local timezone (UTC${this.getTimezoneOffset()})
        </div>
        <div class="chart-container">
          <canvas id="source-time-chart"></canvas>
        </div>
        <div class="legend-info" id="legend-info" style="display: none;">
          Showing top sources by error count. Hover over lines for details.
        </div>
      </div>
    `;
  }

  /**
   * Set data for the chart
   * @param {Object} sourceData - Object with source names as keys, each containing hourly error counts
   *   Format: { 'source-url': { '2024-01-01T00:00:00': errorCount, ... }, ... }
   */
  setData(sourceData) {
    if (!sourceData || Object.keys(sourceData).length === 0) {
      this.showNoData();
      return;
    }

    this.renderChart(sourceData);
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
    container.innerHTML = '<div class="no-data">No source data available</div>';
    
    const legendInfo = this.shadowRoot.getElementById('legend-info');
    if (legendInfo) legendInfo.style.display = 'none';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  renderChart(sourceData) {
    // Get all unique hours across all sources
    const allHours = new Set();
    Object.values(sourceData).forEach(hourData => {
      Object.keys(hourData).forEach(hour => allHours.add(hour));
    });

    // Sort hours chronologically
    const sortedHours = [...allHours].sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    // Calculate total errors per source to determine top sources
    const sourceTotals = Object.entries(sourceData).map(([source, hourData]) => ({
      source,
      total: Object.values(hourData).reduce((sum, count) => sum + count, 0),
      hourData
    }));

    // Sort by total and take top N sources
    const topSources = sourceTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, this.maxSources);

    // Generate colors for each source
    const colors = this.generateColors(topSources.length);

    // Create datasets
    const datasets = topSources.map((sourceInfo, index) => {
      const data = sortedHours.map(hour => sourceInfo.hourData[hour] || 0);
      const displayLabel = this.truncateLabel(sourceInfo.source);
      
      return {
        label: displayLabel,
        fullLabel: sourceInfo.source,
        data: data,
        borderColor: colors[index],
        backgroundColor: colors[index] + '33', // 20% opacity for fill
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2
      };
    });

    const canvas = this.shadowRoot.getElementById('source-time-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Format labels for display
    const labels = sortedHours.map(hour => this.formatHour(hour));

    // Create new chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11 },
              boxWidth: 12,
              padding: 8,
              usePointStyle: true
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  return `Hour: ${items[0].label}`;
                }
                return '';
              },
              label: (context) => {
                const dataset = context.dataset;
                const value = context.parsed.y;
                // Use full label in tooltip
                return `${dataset.fullLabel || dataset.label}: ${value} errors`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Error Count'
            },
            ticks: {
              precision: 0
            }
          },
          x: {
            title: {
              display: true,
              text: 'Hour'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    // Show legend info if we have data
    const legendInfo = this.shadowRoot.getElementById('legend-info');
    if (legendInfo && topSources.length > 0) {
      legendInfo.style.display = 'block';
      if (topSources.length < sourceTotals.length) {
        legendInfo.textContent = `Showing top ${topSources.length} of ${sourceTotals.length} sources by error count.`;
      } else {
        legendInfo.textContent = `Showing all ${topSources.length} sources. Hover over lines for details.`;
      }
    }
  }

  truncateLabel(label) {
    const maxLength = 40;
    if (label.length <= maxLength) return label;
    
    // Try to extract just the pathname if it's a URL
    try {
      const url = new URL(label);
      const path = url.pathname;
      if (path.length <= maxLength) return path;
      return path.substring(0, maxLength - 3) + '...';
    } catch {
      return label.substring(0, maxLength - 3) + '...';
    }
  }

  generateColors(count) {
    const palette = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
      '#84cc16', // lime
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(palette[i % palette.length]);
    }
    return colors;
  }

  formatHour(timeSlot) {
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
    
    // Re-render empty state
    const container = this.shadowRoot.querySelector('.chart-container');
    if (container) {
      container.innerHTML = '<canvas id="source-time-chart"></canvas>';
    }
    
    const legendInfo = this.shadowRoot.getElementById('legend-info');
    if (legendInfo) legendInfo.style.display = 'none';
  }
}

// Define the custom element
customElements.define('source-time-chart', SourceTimeChart);

export default SourceTimeChart;

