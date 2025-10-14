/**
 * Engagement Dashboard Web Component
 * Displays form engagement statistics with fill and click event tracking
 */
import '../charts/fill-count-chart.js';
import '../charts/click-count-chart.js';

class EngagementDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.url = '';
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // Cleanup handled by child components
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .dashboard-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 24px;
          margin-bottom: 20px;
        }

        .dashboard-header {
          margin-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 16px;
        }

        .dashboard-header h2 {
          margin: 0 0 12px 0;
          color: #1e40af;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-top: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }

        .stat-item.fills {
          border-left-color: #22c55e;
          background: #f0fdf4;
        }

        .stat-item.clicks {
          border-left-color: #9333ea;
          background: #faf5ff;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }

        .stat-value.fill-color {
          color: #16a34a;
        }

        .stat-value.click-color {
          color: #9333ea;
        }

        .stat-subtext {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 4px;
        }

        .charts-container {
          margin-top: 24px;
        }

        .chart-section {
          margin-bottom: 24px;
        }

        .chart-section:last-child {
          margin-bottom: 0;
        }

        fill-count-chart, click-count-chart {
          display: block;
          width: 100%;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      </style>

      <div class="dashboard-container">
        <div class="dashboard-header">
          <h2>Engagement Dashboard</h2>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Total Page Views</span>
              <span class="stat-value" id="total-views">-</span>
            </div>
            <div class="stat-item fills">
              <span class="stat-label">Views with Fills</span>
              <span class="stat-value fill-color" id="views-with-fills">-</span>
              <span class="stat-subtext" id="fill-rate">-</span>
            </div>
            <div class="stat-item clicks">
              <span class="stat-label">Views with Clicks</span>
              <span class="stat-value click-color" id="views-with-clicks">-</span>
              <span class="stat-subtext" id="click-rate">-</span>
            </div>
            <div class="stat-item fills">
              <span class="stat-label">Average Fills per Page</span>
              <span class="stat-value fill-color" id="avg-fills">-</span>
            </div>
            <div class="stat-item clicks">
              <span class="stat-label">Average Clicks per Page</span>
              <span class="stat-value click-color" id="avg-clicks">-</span>
            </div>
            <div class="stat-item" style="grid-column: 1 / -1;">
              <span class="stat-label">URL</span>
              <span class="stat-value" id="filtered-url" style="font-size: 0.875rem; word-break: break-all; font-weight: 500;">-</span>
            </div>
          </div>
        </div>

        <div class="charts-container">
          <div class="chart-section">
            <fill-count-chart id="fill-count-chart"></fill-count-chart>
          </div>
          <div class="chart-section">
            <click-count-chart id="click-count-chart"></click-count-chart>
          </div>
        </div>
      </div>
    `;
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.updateSummaryStats();
    this.updateCharts();
  }

  updateCharts() {
    if (!this.dataChunks || !this.dataChunks.facets.hour) return;

    const fillChart = this.shadowRoot.getElementById('fill-count-chart');
    const clickChart = this.shadowRoot.getElementById('click-count-chart');

    fillChart.setData(this.dataChunks.facets.hour);
    clickChart.setData(this.dataChunks.facets.hour);
  }

  updateSummaryStats() {
    if (!this.dataChunks) return;

    const totals = this.dataChunks.totals;
    const totalViews = totals.pageViews?.sum || 0;
    const viewsWithFills = totals.fills?.sum || 0;
    const viewsWithClicks = totals.clicks?.sum || 0;
    const avgFills = totals.fillCount?.mean || 0;
    const avgClicks = totals.clickCount?.mean || 0;

    // Calculate rates
    const fillRate = totalViews > 0 ? (viewsWithFills / totalViews) * 100 : 0;
    const clickRate = totalViews > 0 ? (viewsWithClicks / totalViews) * 100 : 0;

    // Update all stat values
    this.shadowRoot.getElementById('total-views').textContent = totalViews.toLocaleString();
    this.shadowRoot.getElementById('views-with-fills').textContent = viewsWithFills.toLocaleString();
    this.shadowRoot.getElementById('views-with-clicks').textContent = viewsWithClicks.toLocaleString();
    this.shadowRoot.getElementById('avg-fills').textContent = avgFills.toFixed(1);
    this.shadowRoot.getElementById('avg-clicks').textContent = avgClicks.toFixed(1);

    // Update rates
    this.shadowRoot.getElementById('fill-rate').textContent = `${fillRate.toFixed(1)}% engagement`;
    this.shadowRoot.getElementById('click-rate').textContent = `${clickRate.toFixed(1)}% engagement`;

    this.shadowRoot.getElementById('filtered-url').textContent = this.url || 'All URLs';
  }

  reset() {
    const fillChart = this.shadowRoot.getElementById('fill-count-chart');
    const clickChart = this.shadowRoot.getElementById('click-count-chart');

    if (fillChart) {
      fillChart.reset();
    }
    if (clickChart) {
      clickChart.reset();
    }

    this.dataChunks = null;
    this.url = '';
  }
}

// Define the custom element
customElements.define('engagement-dashboard', EngagementDashboard);

export default EngagementDashboard;

