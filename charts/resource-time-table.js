/**
 * Resource Time Table Web Component
 * Displays resource loading times with mean, median, and max statistics
 */

class ResourceTimeTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.resourceData = null;
    this.sortColumn = 'mean';
    this.sortDirection = 'desc';
    this.searchTerm = '';
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }

        .table-title {
          margin: 0;
          color: #1e40af;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          width: 250px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .table-wrapper {
          overflow-x: auto;
          max-height: 600px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          position: sticky;
          top: 0;
          background: #f9fafb;
          z-index: 10;
        }

        th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }

        th:hover {
          background: #f3f4f6;
        }

        th.sortable::after {
          content: '⇅';
          margin-left: 4px;
          color: #9ca3af;
        }

        th.sorted-asc::after {
          content: '↑';
          color: #3b82f6;
        }

        th.sorted-desc::after {
          content: '↓';
          color: #3b82f6;
        }

        td {
          padding: 12px 16px;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }

        tbody tr:hover {
          background: #f9fafb;
        }

        tbody tr.fast {
          background: #f0fdf4;
        }

        tbody tr.moderate {
          background: #fffbeb;
        }

        tbody tr.slow {
          background: #fef2f2;
        }

        .resource-url {
          font-family: monospace;
          word-break: break-all;
          max-width: 400px;
        }

        .time-value {
          font-weight: 600;
          font-family: 'SF Mono', Monaco, monospace;
        }

        .time-value.fast {
          color: #059669;
        }

        .time-value.moderate {
          color: #d97706;
        }

        .time-value.slow {
          color: #dc2626;
        }

        .count-badge {
          display: inline-block;
          padding: 4px 8px;
          background: #e5e7eb;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
          font-style: italic;
          background: #f9fafb;
        }

        .summary-stats {
          display: flex;
          gap: 24px;
          padding: 16px;
          background: #eff6ff;
          border-bottom: 1px solid #e5e7eb;
        }

        .summary-stat {
          display: flex;
          flex-direction: column;
        }

        .summary-label {
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e40af;
        }

        @media (max-width: 768px) {
          .search-input {
            width: 150px;
          }

          .resource-url {
            max-width: 200px;
          }

          .summary-stats {
            flex-wrap: wrap;
            gap: 12px;
          }
        }
      </style>

      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">Resource Loading Times</h3>
          <div class="search-box">
            <input
              type="text"
              class="search-input"
              placeholder="Search resources..."
              id="search-input"
            />
          </div>
        </div>

        <div class="summary-stats" id="summary-stats">
          <div class="summary-stat">
            <span class="summary-label">Total Resources</span>
            <span class="summary-value" id="total-resources">-</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">Avg Load Time</span>
            <span class="summary-value" id="avg-time">-</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">Slowest Resource</span>
            <span class="summary-value" id="slowest-time">-</span>
          </div>
        </div>

        <div class="table-wrapper">
          <table id="resource-table">
            <thead>
              <tr>
                <th class="sortable" data-column="url">Resource URL</th>
                <th class="sortable" data-column="mean">Mean</th>
                <th class="sortable" data-column="median">Median (p50)</th>
                <th class="sortable" data-column="max">Max</th>
                <th class="sortable" data-column="count">Count</th>
              </tr>
            </thead>
            <tbody id="table-body">
              <tr>
                <td colspan="5" class="no-data">No resource data available</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Search input
    const searchInput = this.shadowRoot.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.updateTable();
    });

    // Column sorting
    const headers = this.shadowRoot.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.column;
        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = column;
          this.sortDirection = 'desc';
        }
        this.updateTable();
      });
    });
  }

  setData(dataChunks) {
    if (!dataChunks || !dataChunks.facets.resourceTarget) {
      return;
    }

    // Process resource data to calculate statistics
    const resourceStats = new Map();

    dataChunks.facets.resourceTarget.forEach(facet => {
      const url = facet.value;
      const weight = facet.weight;
      const count = facet.count;

      // Get the timing data for this specific resource
      // We need to access the series data
      if (!resourceStats.has(url)) {
        resourceStats.set(url, {
          url,
          times: [],
          count: 0,
          weight: 0
        });
      }

      const stat = resourceStats.get(url);
      stat.count += count;
      stat.weight += weight;
    });

    // Get timing data from bundles if available
    if (dataChunks.bundles) {
      dataChunks.bundles.forEach(bundle => {
        bundle.events
          .filter(e => e.checkpoint === 'loadresource' && e.target && e.timeDelta)
          .forEach(event => {
            const url = event.target;
            const time = event.timeDelta / 1000;

            if (resourceStats.has(url)) {
              resourceStats.get(url).times.push(time);
            }
          });
      });
    }

    // Calculate statistics for each resource
    this.resourceData = Array.from(resourceStats.values())
      .filter(stat => stat.times.length > 0)
      .map(stat => {
        const times = stat.times.sort((a, b) => a - b);
        const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
        const median = this.calculateMedian(times);
        const max = Math.max(...times);

        return {
          url: stat.url,
          mean,
          median,
          max,
          count: stat.times.length,
          performanceClass: this.getPerformanceClass(mean)
        };
      });

    this.updateTable();
    this.updateSummaryStats();
  }

  calculateMedian(sortedArray) {
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
    }
    return sortedArray[mid];
  }

  getPerformanceClass(time) {
    if (time < 0.5) return 'fast';
    if (time < 2) return 'moderate';
    return 'slow';
  }

  updateTable() {
    if (!this.resourceData || this.resourceData.length === 0) {
      return;
    }

    // Filter data based on search term
    let filteredData = this.resourceData;
    if (this.searchTerm) {
      filteredData = this.resourceData.filter(item =>
        item.url.toLowerCase().includes(this.searchTerm)
      );
    }

    // Sort data
    filteredData.sort((a, b) => {
      let aVal, bVal;

      switch (this.sortColumn) {
        case 'url':
          aVal = a.url;
          bVal = b.url;
          break;
        case 'mean':
          aVal = a.mean;
          bVal = b.mean;
          break;
        case 'median':
          aVal = a.median;
          bVal = b.median;
          break;
        case 'max':
          aVal = a.max;
          bVal = b.max;
          break;
        case 'count':
          aVal = a.count;
          bVal = b.count;
          break;
        default:
          aVal = a.mean;
          bVal = b.mean;
      }

      if (typeof aVal === 'string') {
        return this.sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Update sort indicators
    const headers = this.shadowRoot.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.classList.remove('sorted-asc', 'sorted-desc');
      if (header.dataset.column === this.sortColumn) {
        header.classList.add(`sorted-${this.sortDirection}`);
      }
    });

    // Render table rows
    const tbody = this.shadowRoot.getElementById('table-body');

    if (filteredData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">No resources match your search</td></tr>';
      return;
    }

    tbody.innerHTML = filteredData.map(item => `
      <tr class="${item.performanceClass}">
        <td class="resource-url">${this.escapeHtml(item.url)}</td>
        <td><span class="time-value ${item.performanceClass}">${this.formatTime(item.mean)}</span></td>
        <td><span class="time-value ${item.performanceClass}">${this.formatTime(item.median)}</span></td>
        <td><span class="time-value ${item.performanceClass}">${this.formatTime(item.max)}</span></td>
        <td><span class="count-badge">${item.count.toLocaleString()}</span></td>
      </tr>
    `).join('');
  }

  updateSummaryStats() {
    if (!this.resourceData || this.resourceData.length === 0) {
      return;
    }

    const totalResources = this.resourceData.length;
    const avgTime = this.resourceData.reduce((sum, item) => sum + item.mean, 0) / totalResources;
    const slowestTime = Math.max(...this.resourceData.map(item => item.max));

    this.shadowRoot.getElementById('total-resources').textContent = totalResources.toLocaleString();
    this.shadowRoot.getElementById('avg-time').textContent = this.formatTime(avgTime);
    this.shadowRoot.getElementById('slowest-time').textContent = this.formatTime(slowestTime);
  }

  formatTime(seconds) {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  reset() {
    this.resourceData = null;
    this.searchTerm = '';
    const tbody = this.shadowRoot.getElementById('table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">No resource data available</td></tr>';
    }
  }
}

customElements.define('resource-time-table', ResourceTimeTable);

export default ResourceTimeTable;

