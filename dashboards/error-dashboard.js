/**
 * Error Dashboard Web Component
 * Displays hourly error counts with interactive drill-down into error sources and targets
 */
import '../charts/error-rate-chart.js';
import '../charts/user-agent-pie-chart.js';

class ErrorDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.url = '';
    this.selectedHour = null;
    this.selectedResourceTypes = new Set(['image', 'javascript', 'css', 'json', 'others']);
    // Top-level filter state (both are multi-select, empty = all)
    this.selectedDeviceTypes = [];
    this.selectedSources = [];
    // Status filter for missing resources (empty = all)
    this.selectedStatuses = new Set();
    this.availableStatuses = new Set();
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

        .stat-item.error-stat {
          /*border-left-color: #ef4444;
          background: #fef2f2;*/
        }

        .stat-item.warning {
          /*border-left-color: #f59e0b;
          background: #fffbeb;*/
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

        .stat-value.error {
          color: #dc2626;
        }

        .stat-value.warning-color {
          color: #d97706;
        }

        .stat-value.success {
          color: #059669;
        }

        .stat-subtext {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 4px;
        }

        error-rate-chart {
          margin-bottom: 24px;
        }

        .resources-section {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 2px solid #e5e7eb;
        }

        .resources-section h3 {
          margin: 0 0 16px 0;
          color: #1e40af;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .resource-filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin: 8px 0 12px;
        }

        .filter-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-right: 4px;
          font-weight: 500;
        }

        .filter-option {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 6px 10px;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          user-select: none;
        }

        .filter-option input[type="checkbox"] {
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .filter-count-badge {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .filters-count {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 4px 10px;
          font-size: 0.75rem;
          color: #374151;
          font-weight: 600;
        }

        .resources-list {
          max-height: 600px;
          overflow-y: auto;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .resources-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .resources-table th {
          background: #f3f4f6;
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .resources-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .resources-table tr:hover {
          background: #f9fafb;
        }

        .resources-table tr.high-frequency {
          background: #fef2f2;
        }

        .resources-table tr.high-frequency:hover {
          background: #fee2e2;
        }

        .resources-table tr.medium-frequency {
          background: #fffbeb;
        }

        .resources-table tr.medium-frequency:hover {
          background: #fef3c7;
        }

        .resource-url {
          font-family: monospace;
          word-break: break-all;
          color: #374151;
          max-width: 400px;
        }

        .resource-target {
          font-family: monospace;
          color: #6b7280;
          font-size: 0.8125rem;
          max-width: 200px;
          word-break: break-all;
        }

        .resource-target.has-status {
          color: #dc2626;
          font-weight: 500;
        }

        .target-expand-btn {
          color: #3b82f6;
          cursor: pointer;
          font-weight: 500;
          text-decoration: underline;
          margin-left: 4px;
        }

        .target-expand-btn:hover {
          color: #1d4ed8;
        }

        .target-list {
          display: none;
          margin-top: 4px;
          padding: 4px 0;
        }

        .target-list.expanded {
          display: block;
        }

        .target-list-item {
          font-size: 0.75rem;
          padding: 2px 0;
          color: #6b7280;
        }

        .status-filter-group {
          margin-left: 16px;
          padding-left: 16px;
          border-left: 1px solid #e5e7eb;
        }

        .status-filter-select {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.8125rem;
          background: white;
          min-width: 120px;
        }

        .status-chips {
          display: inline-flex;
          gap: 4px;
          margin-left: 8px;
          flex-wrap: wrap;
        }

        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 8px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 12px;
          font-size: 0.75rem;
        }

        .status-chip .remove-status {
          cursor: pointer;
          font-weight: bold;
        }

        .status-chip .remove-status:hover {
          color: #dc2626;
        }

        .resource-type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .resource-type-badge.image {
          background: #dbeafe;
          color: #1e40af;
        }

        .resource-type-badge.javascript {
          background: #fef3c7;
          color: #92400e;
        }

        .resource-type-badge.css {
          background: #d1fae5;
          color: #065f46;
        }

        .resource-type-badge.json {
          background: #e0e7ff;
          color: #3730a3;
        }

        .resource-type-badge.others {
          background: #f3f4f6;
          color: #374151;
        }

        .resource-count {
          font-weight: 700;
          font-size: 1rem;
          text-align: right;
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
          font-size: 0.8125rem;
          color: #6b7280;
          text-align: right;
        }

        .threshold-legend {
          display: flex;
          gap: 12px;
          margin: 8px 0 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .legend-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .legend-badge.high {
          background: #fef2f2;
          color: #dc2626;
        }

        .legend-badge.medium {
          background: #fffbeb;
          color: #d97706;
        }

        .legend-badge.low {
          background: #f3f4f6;
          color: #6b7280;
        }

        .no-data.success {
          color: #059669;
          background: #f0fdf4;
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
          grid-template-columns: repeat(1, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .detail-section {
          background: #f9fafb;
          border-radius: 6px;
          padding: 16px;
        }

        .chart-section {
          background: #f9fafb;
          border-radius: 6px;
          padding: 16px;
        }

        .chart-section h4 {
          margin: 0 0 16px 0;
          color: #374151;
          font-size: 1rem;
          font-weight: 600;
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

        .top-filters-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .top-filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .top-filter-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .top-filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          background: white;
          min-width: 180px;
          cursor: pointer;
        }

        .top-filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .top-filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-width: 400px;
        }

        .top-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .top-filter-chip.device {
          background: #dcfce7;
          color: #166534;
        }

        .top-filter-chip .remove-chip {
          cursor: pointer;
          font-weight: bold;
          margin-left: 2px;
        }

        .top-filter-chip .remove-chip:hover {
          color: #dc2626;
        }

        .clear-top-filters-btn {
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          color: #374151;
          transition: all 0.2s;
          margin-left: auto;
        }

        .clear-top-filters-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }

        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .details-grid {
            grid-template-columns: 1fr;
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
        <div class="top-filters-bar" id="top-filters-bar">
          <div class="top-filter-group">
            <span class="top-filter-label">Device Type</span>
            <select class="top-filter-select" id="device-filter">
              <option value="">Add Device Filter...</option>
            </select>
          </div>
          <div class="top-filter-group" id="device-chips-container" style="display: none;">
            <span class="top-filter-label">Active Devices</span>
            <div class="top-filter-chips" id="device-chips"></div>
          </div>
          <div class="top-filter-group">
            <span class="top-filter-label">Source</span>
            <select class="top-filter-select" id="source-filter">
              <option value="">Add Source Filter...</option>
            </select>
          </div>
          <div class="top-filter-group" id="source-chips-container" style="display: none;">
            <span class="top-filter-label">Active Sources</span>
            <div class="top-filter-chips" id="source-chips"></div>
          </div>
          <button class="clear-top-filters-btn" id="clear-top-filters-btn">Clear Filters</button>
        </div>

        <div class="dashboard-header">
          <h2>Error Analysis</h2>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-item error-stat">
              <span class="stat-label">Total Errors</span>
              <span class="stat-value error" id="total-errors">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Page Views</span>
              <span class="stat-value" id="total-views">-</span>
            </div>
            <div class="stat-item error-stat">
              <span class="stat-label">Average Error Rate</span>
              <span class="stat-value error" id="avg-error-rate">-</span>
            </div>
            <div class="stat-item warning">
              <span class="stat-label">Page Views with Missing Resources</span>
              <span class="stat-value warning-color" id="pages-with-missing">-</span>
              <span class="stat-subtext" id="pages-percentage">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Unique Missing Resources</span>
              <span class="stat-value" id="unique-resources">-</span>
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
            <div class="detail-list" id="error-sources-list"></div>
          </div>
          <div class="chart-section">
            <h4>User Agent Distribution</h4>
            <user-agent-pie-chart id="user-agent-chart"></user-agent-pie-chart>
          </div>
        </div>

        <div class="resources-section">
          <h3>Missing Resources (sorted by frequency)</h3>
          <div class="resource-filters" id="resource-filters">
            <span class="filter-label">Filter by type:</span>
            <label class="filter-option">
              <input type="checkbox" data-type="image" checked />
              Image
            </label>
            <label class="filter-option">
              <input type="checkbox" data-type="javascript" checked />
              JavaScript
            </label>
            <label class="filter-option">
              <input type="checkbox" data-type="css" checked />
              CSS
            </label>
            <label class="filter-option">
              <input type="checkbox" data-type="json" checked />
              JSON
            </label>
            <label class="filter-option">
              <input type="checkbox" data-type="others" checked />
              Others
            </label>
            <div class="status-filter-group">
              <span class="filter-label">Filter by status:</span>
              <select class="status-filter-select" id="status-filter">
                <option value="">All Statuses</option>
              </select>
              <span class="status-chips" id="status-chips"></span>
            </div>
            <div class="filters-count" id="resources-count"></div>
          </div>
          <div class="threshold-legend" id="threshold-legend"></div>
          <div class="resources-list" id="resources-list">
            <div class="loading">Loading resources...</div>
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

    // Resource type filters
    const filtersContainer = this.shadowRoot.getElementById('resource-filters');
    if (filtersContainer) {
      const inputs = Array.from(filtersContainer.querySelectorAll('input[type="checkbox"][data-type]'));
      inputs.forEach((input) => {
        input.addEventListener('change', () => {
          const type = input.getAttribute('data-type');
          if (input.checked) {
            this.selectedResourceTypes.add(type);
          } else {
            this.selectedResourceTypes.delete(type);
          }
          this.updateResourcesList();
        });
      });
    }

    // Status filter
    const statusFilter = this.shadowRoot.getElementById('status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value && !this.selectedStatuses.has(value)) {
          this.selectedStatuses.add(value);
          this.updateStatusChips();
          this.updateResourcesList();
        }
        e.target.value = '';
      });
    }

    // Top-level filter event listeners
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    deviceFilter.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value && !this.selectedDeviceTypes.includes(value)) {
        this.selectedDeviceTypes.push(value);
        this.updateDeviceChips();
        this.applyTopFilters();
      }
      e.target.value = '';
    });

    const sourceFilter = this.shadowRoot.getElementById('source-filter');
    sourceFilter.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value && !this.selectedSources.includes(value)) {
        this.selectedSources.push(value);
        this.updateSourceChips();
        this.applyTopFilters();
      }
      e.target.value = '';
    });

    const clearTopFiltersBtn = this.shadowRoot.getElementById('clear-top-filters-btn');
    clearTopFiltersBtn.addEventListener('click', () => {
      this.selectedDeviceTypes = [];
      this.selectedSources = [];
      this.updateDeviceChips();
      this.updateSourceChips();
      this.applyTopFilters();
    });
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.populateTopFilters();
    this.applyTopFilters();
  }

  populateTopFilters() {
    if (!this.dataChunks) return;

    // Populate device type filter
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    const deviceTypes = this.dataChunks.facets.deviceType || [];
    
    deviceFilter.innerHTML = '<option value="">Add Device Filter...</option>';
    deviceTypes
      .sort((a, b) => b.count - a.count)
      .forEach(dt => {
        const option = document.createElement('option');
        option.value = dt.value;
        option.textContent = `${dt.value} (${dt.count})`;
        deviceFilter.appendChild(option);
      });

    // Populate source filter
    const sourceFilter = this.shadowRoot.getElementById('source-filter');
    const sources = this.dataChunks.facets.source || [];
    
    sourceFilter.innerHTML = '<option value="">Add Source Filter...</option>';
    sources
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .forEach(src => {
        const option = document.createElement('option');
        option.value = src.value;
        const displayText = src.value.length > 60 
          ? src.value.substring(0, 57) + '...' 
          : src.value;
        option.textContent = `${displayText} (${src.count})`;
        sourceFilter.appendChild(option);
      });

    this.updateDeviceChips();
    this.updateSourceChips();
  }

  updateDeviceChips() {
    const chipsContainer = this.shadowRoot.getElementById('device-chips');
    const chipsWrapper = this.shadowRoot.getElementById('device-chips-container');

    if (this.selectedDeviceTypes.length === 0) {
      chipsWrapper.style.display = 'none';
      return;
    }

    chipsWrapper.style.display = 'flex';
    chipsContainer.innerHTML = this.selectedDeviceTypes.map(device => {
      return `
        <span class="top-filter-chip device" data-device="${this.escapeHtml(device)}">
          ${this.escapeHtml(device)}
          <span class="remove-chip" data-device="${this.escapeHtml(device)}">×</span>
        </span>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const deviceToRemove = e.target.dataset.device;
        this.selectedDeviceTypes = this.selectedDeviceTypes.filter(d => d !== deviceToRemove);
        this.updateDeviceChips();
        this.applyTopFilters();
      });
    });
  }

  updateSourceChips() {
    const chipsContainer = this.shadowRoot.getElementById('source-chips');
    const chipsWrapper = this.shadowRoot.getElementById('source-chips-container');

    if (this.selectedSources.length === 0) {
      chipsWrapper.style.display = 'none';
      return;
    }

    chipsWrapper.style.display = 'flex';
    chipsContainer.innerHTML = this.selectedSources.map(src => {
      const displayText = src.length > 40 ? src.substring(0, 37) + '...' : src;
      return `
        <span class="top-filter-chip" data-source="${this.escapeHtml(src)}">
          ${this.escapeHtml(displayText)}
          <span class="remove-chip" data-source="${this.escapeHtml(src)}">×</span>
        </span>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sourceToRemove = e.target.dataset.source;
        this.selectedSources = this.selectedSources.filter(s => s !== sourceToRemove);
        this.updateSourceChips();
        this.applyTopFilters();
      });
    });
  }

  applyTopFilters() {
    if (!this.dataChunks) return;

    // Build filter object
    const filter = {};
    
    if (this.selectedDeviceTypes.length > 0) {
      filter.deviceType = this.selectedDeviceTypes;
    }
    
    if (this.selectedSources.length > 0) {
      filter.source = this.selectedSources;
    }

    // Apply filter to dataChunks
    this.dataChunks.filter = filter;

    // Update all panels with filtered data
    this.updateSummaryStats();
    this.updateChart();
    this.updateResourcesList();
    this.updateFilterCounts();
    this.updateUserAgentChart();
    this.selectHour(null);
  }

  updateUserAgentChart() {
    if (!this.dataChunks) return;
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (!userAgentChart) return;
    
    const userAgentFacets = this.dataChunks.facets.userAgent || [];
    userAgentChart.setData(userAgentFacets);
  }

  updateStatusChips() {
    const chipsContainer = this.shadowRoot.getElementById('status-chips');
    if (!chipsContainer) return;

    if (this.selectedStatuses.size === 0) {
      chipsContainer.innerHTML = '';
      return;
    }

    chipsContainer.innerHTML = Array.from(this.selectedStatuses).map(status => {
      return `
        <span class="status-chip" data-status="${this.escapeHtml(status)}">
          ${this.escapeHtml(status)}
          <span class="remove-status" data-status="${this.escapeHtml(status)}">×</span>
        </span>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.remove-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const statusToRemove = e.target.dataset.status;
        this.selectedStatuses.delete(statusToRemove);
        this.updateStatusChips();
        this.updateResourcesList();
      });
    });
  }

  populateStatusFilter(statuses) {
    const statusFilter = this.shadowRoot.getElementById('status-filter');
    if (!statusFilter) return;

    // Keep the first "All Statuses" option
    statusFilter.innerHTML = '<option value="">Add Status Filter...</option>';
    
    const sortedStatuses = Array.from(statuses).sort();
    sortedStatuses.forEach(status => {
      if (!this.selectedStatuses.has(status)) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusFilter.appendChild(option);
      }
    });
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

    // Get missing resources facet data
    const missingResources = this.dataChunks.facets.missingresource || [];
    const uniqueResourcesCount = missingResources.length;

    // Calculate pages with missing resources (unique page views that had missing resources)
    const pagesWithMissing = missingResources.reduce((sum, resource) => sum + resource.weight, 0);
    this.pagesWithMissing = pagesWithMissing;
    // Calculate percentage
    const pagesPercentage = totalViews > 0 ? (pagesWithMissing / totalViews) * 100 : 0;

    this.shadowRoot.getElementById('total-errors').textContent = totalErrors.toLocaleString();
    this.shadowRoot.getElementById('total-views').textContent = totalViews.toLocaleString();
    this.shadowRoot.getElementById('avg-error-rate').textContent = `${avgErrorRate.toFixed(2)}%`;
    this.shadowRoot.getElementById('pages-with-missing').textContent = pagesWithMissing.toLocaleString();
    this.shadowRoot.getElementById('unique-resources').textContent = uniqueResourcesCount.toLocaleString();
    this.shadowRoot.getElementById('pages-percentage').textContent = `${pagesPercentage.toFixed(1)}% of page views affected`;
  }

  updateFilter(filter) {
    this.dataChunks.filter = {
      ...this.dataChunks.filters,
      ...filter
    };
  }

  selectHour(hourData) {
    this.selectedHour = hourData;


    // Use DataChunks filter to filter by the selected hour
    // Filter the dataChunks to only include bundles from this hour
    if (hourData != null) {
      // Update selected hour label
      this.shadowRoot.getElementById('selected-hour-label').textContent = hourData.hour;
      this.updateFilter({
        hour: [hourData.rawHour]
      });
    }

    // Access the errorSource, errorTarget, and userAgent facets for this filtered hour
    const errorSourceFacets = this.dataChunks.facets.errorSource || [];
    const errorTargetFacets = this.dataChunks.facets.errorTarget || [];
    const userAgentFacets = this.dataChunks.facets.userAgent || [];
    const errorDetailsFacets = this.dataChunks.facets.errorDetails || [];

    // Calculate total errors in this hour
    const totalErrorsInHour = this.dataChunks.totals.errorCount?.sum || 0;

    // Render sources and targets using facet data
    this.renderDetailListFromFacets('error-sources-list', errorDetailsFacets, totalErrorsInHour);

    // Render user agent pie chart
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.setData(userAgentFacets);
    }

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

  updateFilterCounts() {
    const filtersContainer = this.shadowRoot.getElementById('resource-filters');
    if (!filtersContainer) return;
    const missingResources = this.dataChunks?.facets?.missingresource || [];
    const counts = { image: 0, javascript: 0, css: 0, json: 0, others: 0 };
    for (const res of missingResources) {
      const category = this.categorizeResource(res.value);
      if (counts[category] != null) counts[category] += 1;
    }
    const inputs = Array.from(filtersContainer.querySelectorAll('input[type="checkbox"][data-type]'));
    inputs.forEach((input) => {
      const type = input.getAttribute('data-type');
      const label = input.closest('label');
      if (!label) return;
      let badge = label.querySelector('.filter-count-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'filter-count-badge';
        label.appendChild(document.createTextNode(' '));
        label.appendChild(badge);
      }
      const value = counts[type] != null ? counts[type] : 0;
      badge.textContent = `(${value.toLocaleString()})`;
    });
  }

  updateThresholdLegend() {
    const legend = this.shadowRoot.getElementById('threshold-legend');
    if (!legend) return;
    const missingResources = this.dataChunks?.facets?.missingresource || [];
    const maxCount = this.pagesWithMissing || 0;
    if (missingResources.length === 0 || maxCount === 0) {
      legend.innerHTML = '';
      return;
    }
    const highThreshold = maxCount * 0.4;
    const mediumThreshold = maxCount * 0.1;
    const highMin = Math.ceil(highThreshold);
    const mediumMin = Math.ceil(mediumThreshold);
    legend.innerHTML = `
      <div class="legend-item">
        <span class="legend-badge high">High</span>
        ≥ 40% of max (≥ ${highMin})
      </div>
      <div class="legend-item">
        <span class="legend-badge medium">Medium</span>
        ≥ 10% and < 40% of max (≥ ${mediumMin} and < ${highMin})
      </div>
      <div class="legend-item">
        <span class="legend-badge low">Low</span>
        < 10% of max (< ${mediumMin})
      </div>
    `;
  }

  extractExtension(resourceUrl) {
    if (!resourceUrl || typeof resourceUrl !== 'string') return null;
    try {
      // Strip query/hash
      const noQuery = resourceUrl.split('#')[0].split('?')[0];
      // Get the last path segment
      const lastSlash = noQuery.lastIndexOf('/');
      const lastSegment = lastSlash >= 0 ? noQuery.slice(lastSlash + 1) : noQuery;
      if (!lastSegment) return null;
      const lastDot = lastSegment.lastIndexOf('.');
      if (lastDot <= 0 || lastDot === lastSegment.length - 1) {
        return null;
      }
      return lastSegment.slice(lastDot + 1).toLowerCase();
    } catch (e) {
      return null;
    }
  }

  categorizeResource(resourceUrl) {
    const ext = this.extractExtension(resourceUrl);
    if (!ext) return 'others';
    // Images
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'tif', 'tiff', 'avif']);
    if (imageExts.has(ext)) return 'image';
    // JavaScript
    const jsExts = new Set(['js', 'mjs', 'cjs']);
    if (jsExts.has(ext)) return 'javascript';
    // CSS
    if (ext === 'css') return 'css';
    // JSON
    if (ext === 'json') return 'json';
    // Others
    return 'others';
  }

  updateResourcesList() {
    if (!this.dataChunks) return;

    const container = this.shadowRoot.getElementById('resources-list');
    
    // Use missingResourceDetails facet which contains "source|||target" format
    const missingResourceDetails = this.dataChunks.facets.missingResourceDetails || [];
    // Fallback to missingresource if details not available
    const missingResources = this.dataChunks.facets.missingresource || [];

    // Check if we have data
    if (missingResources.length === 0 && missingResourceDetails.length === 0) {
      const countBadge = this.shadowRoot.getElementById('resources-count');
      if (countBadge) {
        countBadge.textContent = '0 out of 0 visible';
      }
      this.updateFilterCounts();
      this.updateThresholdLegend();
      container.innerHTML = '<div class="no-data success">✓ No missing resources detected! All resources loaded successfully.</div>';
      return;
    }

    // Parse the details to get source and target separately
    // Build a map of source -> targets for easy lookup
    const targetMap = new Map();
    const allStatuses = new Set();
    
    missingResourceDetails.forEach(detail => {
      const [source, target] = detail.value.split('|||');
      if (source && target && target.trim()) {
        // Aggregate targets if multiple exist for same source
        if (!targetMap.has(source)) {
          targetMap.set(source, new Set());
        }
        targetMap.get(source).add(target);
        allStatuses.add(target);
      }
    });

    // Populate the status filter dropdown with available statuses
    this.populateStatusFilter(allStatuses);

    // Filter by selected resource types
    const activeTypes = this.selectedResourceTypes;
    let filteredResources = missingResources.filter((res) => activeTypes.has(this.categorizeResource(res.value)));

    // Filter by selected statuses if any
    if (this.selectedStatuses.size > 0) {
      filteredResources = filteredResources.filter(res => {
        const targets = targetMap.get(res.value);
        if (!targets) return false;
        // Check if any of the resource's targets match selected statuses
        return Array.from(targets).some(t => this.selectedStatuses.has(t));
      });
    }

    const countBadge = this.shadowRoot.getElementById('resources-count');
    if (countBadge) {
      countBadge.textContent = `${filteredResources.length} out of ${missingResources.length} visible`;
    }
    // Update per-category counts
    this.updateFilterCounts();
    if (filteredResources.length === 0) {
      container.innerHTML = '<div class="no-data">No resources match the selected filters.</div>';
      // Keep legend consistent with overall stats
      this.updateThresholdLegend();
      return;
    }

    // Sort by weight (descending)
    const sortedResources = [...filteredResources].sort((a, b) => b.weight - a.weight);

    // Determine thresholds for high/medium/low
    const maxCount = this.pagesWithMissing || 0;
    const highThreshold = maxCount * 0.4;
    const mediumThreshold = maxCount * 0.1;

    const totalPageViews = this.dataChunks.totals.pageViews?.sum || 0;

    // Update threshold legend (no duplication)
    this.updateThresholdLegend();

    // Render as table
    const tableHeader = `
      <table class="resources-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Resource URL</th>
            <th>Type</th>
            <th>Target / Status</th>
            <th style="text-align: right;">Count</th>
            <th style="text-align: right;">% of Views</th>
          </tr>
        </thead>
        <tbody>
    `;

    const tableRows = sortedResources.map((resource, index) => {
      const percentage = totalPageViews > 0 ? (resource.weight / totalPageViews) * 100 : 0;
      const frequencyClass = resource.weight >= highThreshold ? 'high-frequency' :
                           resource.weight >= mediumThreshold ? 'medium-frequency' : '';
      const countClass = resource.weight >= highThreshold ? 'high' :
                        resource.weight >= mediumThreshold ? 'medium' : 'low';
      
      // Get resource type
      const resourceType = this.categorizeResource(resource.value);
      
      // Get target/status info if available
      const targets = targetMap.get(resource.value);
      let targetDisplay = '-';
      let hasStatus = false;
      const rowId = `target-row-${index}`;
      
      if (targets && targets.size > 0) {
        const targetArray = Array.from(targets);
        // Check if any target looks like an HTTP status
        hasStatus = targetArray.some(t => /^[1-5]\d{2}$/.test(t) || t.includes('error') || t.includes('failed'));
        
        if (targetArray.length <= 2) {
          targetDisplay = targetArray.map(t => this.escapeHtml(t)).join(', ');
        } else {
          // Show first 2 and make rest expandable
          const visibleTargets = targetArray.slice(0, 2).map(t => this.escapeHtml(t)).join(', ');
          const hiddenTargets = targetArray.slice(2).map(t => `<div class="target-list-item">${this.escapeHtml(t)}</div>`).join('');
          const remainingCount = targetArray.length - 2;
          
          targetDisplay = `
            ${visibleTargets}
            <span class="target-expand-btn" data-target="${rowId}">(+${remainingCount} more)</span>
            <div class="target-list" id="${rowId}">
              ${hiddenTargets}
            </div>
          `;
        }
      }

      return `
        <tr class="${frequencyClass}">
          <td>${index + 1}</td>
          <td class="resource-url">${this.escapeHtml(resource.value)}</td>
          <td><span class="resource-type-badge ${resourceType}">${resourceType}</span></td>
          <td class="resource-target ${hasStatus ? 'has-status' : ''}">${targetDisplay}</td>
          <td class="resource-count ${countClass}">${resource.weight.toLocaleString()}</td>
          <td class="resource-percentage">${percentage.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    const tableFooter = `
        </tbody>
      </table>
    `;

    container.innerHTML = tableHeader + tableRows + tableFooter;

    // Add click handlers for expandable targets
    container.querySelectorAll('.target-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.target.dataset.target;
        const targetList = container.querySelector(`#${targetId}`);
        if (targetList) {
          const isExpanded = targetList.classList.toggle('expanded');
          e.target.textContent = isExpanded ? '(collapse)' : e.target.textContent.replace('(collapse)', '');
        }
      });
    });
  }

  clearSelection() {
    this.selectedHour = null;
    // Ensure filter is cleared when returning to overview
    if (this.dataChunks) {
      this.dataChunks.filter = {};
    }
    // Reset user agent chart
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.reset();
    }
    this.shadowRoot.getElementById('details-panel').classList.remove('visible');
  }

  reset() {
    this.clearSelection();
    // Reset filter state
    this.selectedDeviceTypes = [];
    this.selectedSources = [];
    this.selectedStatuses = new Set();
    this.updateDeviceChips();
    this.updateSourceChips();
    this.updateStatusChips();
    
    const chart = this.shadowRoot.getElementById('error-chart');
    if (chart) {
      chart.reset();
    }
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.reset();
    }
    this.dataChunks = null;
    this.url = '';
  }
}

// Define the custom element
customElements.define('error-dashboard', ErrorDashboard);

export default ErrorDashboard;

