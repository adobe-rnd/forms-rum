/**
 * Error Dashboard Web Component
 * Displays hourly error counts with interactive drill-down into error sources and targets
 */
import '../charts/error-rate-chart.js';

class ErrorDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.url = '';
    this.selectedHour = null;
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
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }

        .stat-value.error {
          color: #dc2626;
        }

        .stat-value.success {
          color: #059669;
        }

        error-rate-chart {
          margin-bottom: 24px;
        }

        .details-panel {
          display: none;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 2px solid #e5e7eb;
        }

        .details-panel.visible {
          display: block;
        }

        .details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .details-header h3 {
          margin: 0;
          color: #1e40af;
          font-size: 1.25rem;
        }

        .back-button {
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          color: #374151;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .detail-section {
          background: #f9fafb;
          border-radius: 6px;
          padding: 16px;
        }

        .detail-section h4 {
          margin: 0 0 16px 0;
          color: #374151;
          font-size: 1rem;
          font-weight: 600;
        }

        .detail-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          margin-bottom: 8px;
          transition: background-color 0.2s;
        }

        .detail-item:hover {
          background: #f3f4f6;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-name {
          flex: 1;
          font-size: 0.875rem;
          color: #374151;
          word-break: break-word;
          margin-right: 12px;
        }

        .detail-stats {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-shrink: 0;
        }

        .detail-count {
          font-weight: 600;
          color: #1f2937;
          font-size: 0.875rem;
        }

        .detail-percentage {
          font-size: 0.75rem;
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        .loading {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .summary-stats {
            flex-direction: column;
            gap: 12px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="dashboard-container">
        <div class="dashboard-header">
          <h2>Error Analysis Dashboard</h2>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Total Errors</span>
              <span class="stat-value error" id="total-errors">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Page Views</span>
              <span class="stat-value" id="total-views">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Average Error Rate</span>
              <span class="stat-value" id="avg-error-rate">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">URL</span>
              <span class="stat-value" id="filtered-url" style="font-size: 0.875rem; word-break: break-all;">-</span>
            </div>
          </div>
        </div>

        <error-rate-chart id="error-chart"></error-rate-chart>

        <div class="details-panel" id="details-panel">
          <div class="details-header">
            <h3>Error Details for <span id="selected-hour-label">-</span></h3>
            <button class="back-button" id="back-button">← Back to Overview</button>
          </div>
          <div class="details-grid">
            <div class="detail-section">
              <h4>Error Lines</h4>
              <div class="detail-list" id="error-sources-list"></div>
            </div>
            <div class="detail-section">
              <h4>Error Messages</h4>
              <div class="detail-list" id="error-targets-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const backButton = this.shadowRoot.getElementById('back-button');
    backButton.addEventListener('click', () => this.clearSelection());

    // Listen for hour selection from chart
    const chart = this.shadowRoot.getElementById('error-chart');
    chart.addEventListener('hour-selected', (event) => {
      this.selectHour(event.detail);
    });
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.updateSummaryStats();
    this.updateChart();
  }

  updateChart() {
    if (!this.dataChunks || !this.dataChunks.facets.hour) return;

    const chart = this.shadowRoot.getElementById('error-chart');
    chart.setData(this.dataChunks.facets.hour);
  }

  updateSummaryStats() {
    if (!this.dataChunks) return;

    const totals = this.dataChunks.totals;
    const totalErrors = totals.errorCount?.sum || 0;
    const totalViews = totals.pageViews?.sum || 0;
    const avgErrorRate = totalViews > 0 ? (totalErrors / totalViews) * 100 : 0;

    this.shadowRoot.getElementById('total-errors').textContent = totalErrors.toLocaleString();
    this.shadowRoot.getElementById('total-views').textContent = totalViews.toLocaleString();
    this.shadowRoot.getElementById('avg-error-rate').textContent = `${avgErrorRate.toFixed(2)}%`;
    this.shadowRoot.getElementById('filtered-url').textContent = this.url || 'All URLs';
  }

  updateFilter(filter) {
    this.dataChunks.filter = {
      ...this.dataChunks.filters,
      ...filter
    };
  }

  selectHour(hourData) {
    this.selectedHour = hourData;

    // Update selected hour label
    this.shadowRoot.getElementById('selected-hour-label').textContent = hourData.hour;

    // Use DataChunks filter to filter by the selected hour
    // Filter the dataChunks to only include bundles from this hour
    this.updateFilter({
      hour: [hourData.rawHour]
    });

    // Access the errorSource and errorTarget facets for this filtered hour
    const errorSourceFacets = this.dataChunks.facets.errorSource || [];
    const errorTargetFacets = this.dataChunks.facets.errorTarget || [];

    // Calculate total errors in this hour
    const totalErrorsInHour = hourData.errorCount;

    // Render sources and targets using facet data
    this.renderDetailListFromFacets('error-sources-list', errorSourceFacets, totalErrorsInHour);
    this.renderDetailListFromFacets('error-targets-list', errorTargetFacets, totalErrorsInHour);

    // Clear the filter to reset the dataChunks
    this.dataChunks.filter = {};

    // Show details panel
    this.shadowRoot.getElementById('details-panel').classList.add('visible');
  }

  renderDetailListFromFacets(containerId, facets, totalErrors) {
    const container = this.shadowRoot.getElementById(containerId);

    if (!facets || facets.length === 0) {
      container.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    const facetsWithErrorCounts = facets.map(facet => {
      return {
        value: facet.value,
        count: facet.count
      };
    });

    const html = facetsWithErrorCounts.map(({ value, count }) => {
      const percentage = totalErrors > 0 ? (count / totalErrors) * 100 : 0;
      return `
        <div class="detail-item">
          <div class="detail-name">${this.escapeHtml(value)}</div>
          <div class="detail-stats">
            <span class="detail-count">${count}</span>
            <span class="detail-percentage">${percentage.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearSelection() {
    this.selectedHour = null;
    // Ensure filter is cleared when returning to overview
    if (this.dataChunks) {
      this.dataChunks.filter = {};
    }
    this.shadowRoot.getElementById('details-panel').classList.remove('visible');
  }

  reset() {
    this.clearSelection();
    const chart = this.shadowRoot.getElementById('error-chart');
    if (chart) {
      chart.reset();
    }
    this.dataChunks = null;
    this.url = '';
  }
}

// Define the custom element
customElements.define('error-dashboard', ErrorDashboard);

export default ErrorDashboard;

