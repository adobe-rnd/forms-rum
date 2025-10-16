/**
 * Resource Dashboard Web Component
 * Displays missing resources with frequency analysis
 */

class ResourceDashboard extends HTMLElement {
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
    // Cleanup handled by component
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

        .stat-item.warning {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }

        .stat-item.error {
          border-left-color: #ef4444;
          background: #fef2f2;
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

        .stat-value.warning-color {
          color: #d97706;
        }

        .stat-value.error-color {
          color: #dc2626;
        }

        .stat-subtext {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 4px;
        }

        .resources-section {
          margin-top: 24px;
        }

        .resources-section h3 {
          margin: 0 0 16px 0;
          color: #1e40af;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .resources-list {
          max-height: 600px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .resource-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          transition: background-color 0.2s;
        }

        .resource-item:hover {
          background: #f9fafb;
        }

        .resource-item:last-child {
          border-bottom: none;
        }

        .resource-item.high-frequency {
          background: #fef2f2;
        }

        .resource-item.medium-frequency {
          background: #fffbeb;
        }

        .resource-info {
          flex: 1;
          margin-right: 16px;
          min-width: 0;
        }

        .resource-url {
          font-size: 0.875rem;
          color: #374151;
          word-break: break-all;
          font-family: monospace;
          margin-bottom: 4px;
        }

        .resource-details {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .resource-stats {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-shrink: 0;
        }

        .resource-count {
          font-weight: 700;
          font-size: 1.25rem;
          color: #1f2937;
        }

        .resource-count.high {
          color: #dc2626;
        }

        .resource-count.medium {
          color: #f59e0b;
        }

        .resource-count.low {
          color: #6b7280;
        }

        .resource-percentage {
          font-size: 0.875rem;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 600;
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
          font-style: italic;
          background: #f9fafb;
          border-radius: 6px;
        }

        .no-data.success {
          color: #059669;
          background: #f0fdf4;
        }

        .loading {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .resource-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .resource-stats {
            width: 100%;
            justify-content: space-between;
          }
        }
      </style>

      <div class="dashboard-container">
        <div class="dashboard-header">
          <h2>Missing Resources Dashboard</h2>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Total Page Views</span>
              <span class="stat-value" id="total-views">-</span>
            </div>
            <div class="stat-item warning">
              <span class="stat-label">Page Views with Missing Resources</span>
              <span class="stat-value warning-color" id="pages-with-missing">-</span>
              <span class="stat-subtext" id="pages-percentage">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Unique Resources</span>
              <span class="stat-value" id="unique-resources">-</span>
            </div>
            <div class="stat-item" style="grid-column: 1 / -1;">
              <span class="stat-label">URL</span>
              <span class="stat-value" id="filtered-url" style="font-size: 0.875rem; word-break: break-all; font-weight: 500;">-</span>
            </div>
          </div>
        </div>

        <div class="resources-section">
          <h3>Missing Resources (sorted by frequency)</h3>
          <div class="resources-list" id="resources-list">
            <div class="loading">Loading resources...</div>
          </div>
        </div>
      </div>
    `;
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.updateSummaryStats();
    this.updateResourcesList();
  }

  updateSummaryStats() {
    if (!this.dataChunks) return;

    const totals = this.dataChunks.totals;
    const totalViews = totals.pageViews?.sum || 0;

    // Get missing resources facet data
    const missingResources = this.dataChunks.facets.missingresource || [];
    const uniqueResourcesCount = missingResources.length;

    // Calculate total missing resource events
    const totalMissing = missingResources.reduce((sum, resource) => sum + resource.count, 0);

    // Calculate pages with missing resources (unique page views that had missing resources)
    const pagesWithMissing = missingResources.reduce((sum, resource) => sum + resource.weight, 0);

    // Calculate percentage
    const pagesPercentage = totalViews > 0 ? (pagesWithMissing / totalViews) * 100 : 0;

    // Update all stat values
    this.shadowRoot.getElementById('total-views').textContent = totalViews.toLocaleString();
    this.shadowRoot.getElementById('pages-with-missing').textContent = pagesWithMissing.toLocaleString();
    this.shadowRoot.getElementById('unique-resources').textContent = uniqueResourcesCount.toLocaleString();

    // Update percentage
    this.shadowRoot.getElementById('pages-percentage').textContent = `${pagesPercentage.toFixed(1)}% of page views affected`;

    this.shadowRoot.getElementById('filtered-url').textContent = this.url || 'All URLs';
  }

  updateResourcesList() {
    if (!this.dataChunks) return;

    const container = this.shadowRoot.getElementById('resources-list');
    const missingResources = this.dataChunks.facets.missingresource || [];

    // Check if we have data
    if (missingResources.length === 0) {
      container.innerHTML = '<div class="no-data success">✓ No missing resources detected! All resources loaded successfully.</div>';
      return;
    }

    // Sort by count (descending)
    const sortedResources = [...missingResources].sort((a, b) => b.weight - a.weight);

    // Determine thresholds for high/medium/low
    const maxCount = sortedResources[0]?.weight || 0;
    const highThreshold = maxCount * 0.5;
    const mediumThreshold = maxCount * 0.2;

    const totalPageViews = this.dataChunks.totals.pageViews?.sum || 0;

    // Render resources list
    const html = sortedResources.map((resource, index) => {
      const percentage = totalPageViews > 0 ? (resource.weight / totalPageViews) * 100 : 0;
      const frequencyClass = resource.count >= highThreshold ? 'high-frequency' :
                           resource.weight >= mediumThreshold ? 'medium-frequency' : '';
      const countClass = resource.weight >= highThreshold ? 'high' :
                        resource.weight >= mediumThreshold ? 'medium' : 'low';

      return `
        <div class="resource-item ${frequencyClass}">
          <div class="resource-info">
            <div class="resource-url">${this.escapeHtml(resource.value)}</div>
            <div class="resource-details">Rank #${index + 1}</div>
          </div>
          <div class="resource-stats">
            <span class="resource-count ${countClass}">${resource.weight.toLocaleString()}</span>
            <span class="resource-percentage">${percentage.toFixed(1)}%</span>
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

  reset() {
    this.dataChunks = null;
    this.url = '';
  }
}

// Define the custom element
customElements.define('resource-dashboard', ResourceDashboard);

export default ResourceDashboard;

