/**
 * Error Dashboard Web Component
 * Displays hourly error counts with interactive drill-down into error sources and targets
 */
import '../charts/error-rate-chart.js';
import '../charts/user-agent-pie-chart.js';
import '../charts/source-time-chart.js';

class ErrorDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.url = '';
    this.selectedHour = null;
    // Top-level filter state
    this.selectedDeviceType = 'all';
    this.selectedSources = []; // empty = all
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
          border-left-color: #ef4444;
          background: #fef2f2;
        }

        .stat-item.warning {
          border-left-color: #f59e0b;
          background: #fffbeb;
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

        .source-time-section {
          margin-top: 32px;
          margin-bottom: 32px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
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
          grid-template-columns: repeat(2, 1fr);
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

        .filters-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          background: white;
          min-width: 180px;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .source-filter-container {
          position: relative;
        }

        .source-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-width: 400px;
        }

        .source-chip {
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

        .source-chip .remove-chip {
          cursor: pointer;
          font-weight: bold;
          margin-left: 2px;
        }

        .source-chip .remove-chip:hover {
          color: #dc2626;
        }

        .clear-filters-btn {
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

        .clear-filters-btn:hover {
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
        <div class="filters-bar" id="filters-bar">
          <div class="filter-group">
            <span class="filter-label">Device Type</span>
            <select class="filter-select" id="device-filter">
              <option value="all">All Devices</option>
            </select>
          </div>
          <div class="filter-group source-filter-container">
            <span class="filter-label">Source</span>
            <select class="filter-select" id="source-filter">
              <option value="all">All Sources</option>
            </select>
          </div>
          <div class="filter-group" id="source-chips-container" style="display: none;">
            <span class="filter-label">Active Sources</span>
            <div class="source-chips" id="source-chips"></div>
          </div>
          <button class="clear-filters-btn" id="clear-filters-btn">Clear Filters</button>
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

        <div class="source-time-section">
          <source-time-chart id="source-time-chart"></source-time-chart>
        </div>

        <div class="resources-section">
          <h3>Missing Resources (sorted by frequency)</h3>
          <div class="resources-list" id="resources-list">
            <div class="loading">Loading resources...</div>
          </div>
        </div>

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
          <div class="chart-section">
            <h4>User Agent Distribution</h4>
            <user-agent-pie-chart id="user-agent-chart"></user-agent-pie-chart>
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

    // Filter event listeners
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    deviceFilter.addEventListener('change', (e) => {
      this.selectedDeviceType = e.target.value;
      this.applyFilters();
    });

    const sourceFilter = this.shadowRoot.getElementById('source-filter');
    sourceFilter.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value !== 'all' && !this.selectedSources.includes(value)) {
        this.selectedSources.push(value);
        this.updateSourceChips();
        this.applyFilters();
      }
      // Reset dropdown to show placeholder
      e.target.value = 'all';
    });

    const clearFiltersBtn = this.shadowRoot.getElementById('clear-filters-btn');
    clearFiltersBtn.addEventListener('click', () => {
      this.selectedDeviceType = 'all';
      this.selectedSources = [];
      deviceFilter.value = 'all';
      this.updateSourceChips();
      this.applyFilters();
    });
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.populateFilters();
    this.applyFilters();
  }

  populateFilters() {
    if (!this.dataChunks) return;

    // Populate device type filter
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    const deviceTypes = this.dataChunks.facets.deviceType || [];
    
    // Clear existing options except "All"
    deviceFilter.innerHTML = '<option value="all">All Devices</option>';
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
    
    sourceFilter.innerHTML = '<option value="all">Add Source Filter...</option>';
    sources
      .sort((a, b) => b.count - a.count)
      .slice(0, 50) // Limit to top 50 sources
      .forEach(src => {
        const option = document.createElement('option');
        option.value = src.value;
        // Truncate long URLs for display
        const displayText = src.value.length > 60 
          ? src.value.substring(0, 57) + '...' 
          : src.value;
        option.textContent = `${displayText} (${src.count})`;
        deviceFilter.appendChild(option);
        option.value = src.value;
        sourceFilter.appendChild(option);
      });

    // Restore selected device type if still valid
    if (this.selectedDeviceType !== 'all') {
      deviceFilter.value = this.selectedDeviceType;
    }
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
        <span class="source-chip" data-source="${this.escapeHtml(src)}">
          ${this.escapeHtml(displayText)}
          <span class="remove-chip" data-source="${this.escapeHtml(src)}">×</span>
        </span>
      `;
    }).join('');

    // Add click handlers for removing chips
    chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sourceToRemove = e.target.dataset.source;
        this.selectedSources = this.selectedSources.filter(s => s !== sourceToRemove);
        this.updateSourceChips();
        this.applyFilters();
      });
    });
  }

  applyFilters() {
    if (!this.dataChunks) return;

    // Build filter object
    const filter = {};
    
    if (this.selectedDeviceType !== 'all') {
      filter.deviceType = [this.selectedDeviceType];
    }
    
    if (this.selectedSources.length > 0) {
      filter.source = this.selectedSources;
    }

    // Apply filter to dataChunks
    this.dataChunks.filter = filter;

    // Update all panels with filtered data
    this.updateSummaryStats();
    this.updateChart();
    this.updateSourceTimeChart();
    this.updateResourcesList();

    // If we're in hour drill-down, refresh that too
    if (this.selectedHour) {
      this.refreshHourDetails();
    }
  }

  updateSourceTimeChart() {
    if (!this.dataChunks) return;

    const sourceTimeChart = this.shadowRoot.getElementById('source-time-chart');
    if (!sourceTimeChart) return;

    // Get sources and hours facets
    const sources = this.dataChunks.facets.source || [];
    const hours = this.dataChunks.facets.hour || [];

    if (sources.length === 0 || hours.length === 0) {
      sourceTimeChart.setData(null);
      return;
    }

    // Build source data: for each source, get error counts per hour
    // We need to temporarily filter by each source and get hour facets
    const currentFilter = { ...this.dataChunks.filter };
    const sourceData = {};

    // Get top sources by count
    const topSources = [...sources]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    topSources.forEach(source => {
      // Apply filter for this source
      this.dataChunks.filter = {
        ...currentFilter,
        source: [source.value]
      };

      // Get hour facets for this source
      const hourFacets = this.dataChunks.facets.hour || [];
      const hourData = {};

      hourFacets.forEach(hourFacet => {
        const errorCount = hourFacet.metrics.errorCount?.sum || 0;
        hourData[hourFacet.value] = errorCount;
      });

      sourceData[source.value] = hourData;
    });

    // Restore original filter
    this.dataChunks.filter = currentFilter;

    // Set data to chart
    sourceTimeChart.setData(sourceData);
  }

  refreshHourDetails() {
    if (!this.selectedHour || !this.dataChunks) return;

    // Add hour filter on top of existing filters
    const currentFilter = { ...this.dataChunks.filter };
    this.dataChunks.filter = {
      ...currentFilter,
      hour: [this.selectedHour.rawHour]
    };

    // Get facets for this filtered view
    const errorSourceFacets = this.dataChunks.facets.errorSource || [];
    const errorTargetFacets = this.dataChunks.facets.errorTarget || [];
    const userAgentFacets = this.dataChunks.facets.userAgent || [];
    const totalErrorsInHour = this.dataChunks.totals.errorCount?.sum || 0;

    // Render details
    this.renderDetailListFromFacets('error-sources-list', errorSourceFacets, totalErrorsInHour);
    this.renderDetailListFromFacets('error-targets-list', errorTargetFacets, totalErrorsInHour);

    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.setData(userAgentFacets);
    }

    // Restore filter without hour
    this.dataChunks.filter = currentFilter;
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

    // Calculate percentage
    const pagesPercentage = totalViews > 0 ? (pagesWithMissing / totalViews) * 100 : 0;

    this.shadowRoot.getElementById('total-errors').textContent = totalErrors.toLocaleString();
    this.shadowRoot.getElementById('total-views').textContent = totalViews.toLocaleString();
    this.shadowRoot.getElementById('avg-error-rate').textContent = `${avgErrorRate.toFixed(2)}%`;
    this.shadowRoot.getElementById('pages-with-missing').textContent = pagesWithMissing.toLocaleString();
    this.shadowRoot.getElementById('unique-resources').textContent = uniqueResourcesCount.toLocaleString();
    this.shadowRoot.getElementById('pages-percentage').textContent = `${pagesPercentage.toFixed(1)}% of page views affected`;
  }

  selectHour(hourData) {
    this.selectedHour = hourData;

    // Update selected hour label
    this.shadowRoot.getElementById('selected-hour-label').textContent = hourData.hour;

    // Build filter combining top-level filters with hour selection
    const baseFilter = {};
    if (this.selectedDeviceType !== 'all') {
      baseFilter.deviceType = [this.selectedDeviceType];
    }
    if (this.selectedSources.length > 0) {
      baseFilter.source = this.selectedSources;
    }

    // Apply hour filter on top of existing filters
    this.dataChunks.filter = {
      ...baseFilter,
      hour: [hourData.rawHour]
    };

    // Access the errorSource, errorTarget, and userAgent facets for this filtered hour
    const errorSourceFacets = this.dataChunks.facets.errorSource || [];
    const errorTargetFacets = this.dataChunks.facets.errorTarget || [];
    const userAgentFacets = this.dataChunks.facets.userAgent || [];

    // Calculate total errors in this hour (from filtered data)
    const totalErrorsInHour = this.dataChunks.totals.errorCount?.sum || hourData.errorCount;

    // Render sources and targets using facet data
    this.renderDetailListFromFacets('error-sources-list', errorSourceFacets, totalErrorsInHour);
    this.renderDetailListFromFacets('error-targets-list', errorTargetFacets, totalErrorsInHour);

    // Render user agent pie chart
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.setData(userAgentFacets);
    }

    // Restore top-level filters only (remove hour filter)
    this.dataChunks.filter = baseFilter;

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

  updateResourcesList() {
    if (!this.dataChunks) return;

    const container = this.shadowRoot.getElementById('resources-list');
    const missingResources = this.dataChunks.facets.missingresource || [];

    // Check if we have data
    if (missingResources.length === 0) {
      container.innerHTML = '<div class="no-data success">✓ No missing resources detected! All resources loaded successfully.</div>';
      return;
    }

    // Sort by weight (descending)
    const sortedResources = [...missingResources].sort((a, b) => b.weight - a.weight);

    // Determine thresholds for high/medium/low
    const maxCount = sortedResources[0]?.weight || 0;
    const highThreshold = maxCount * 0.5;
    const mediumThreshold = maxCount * 0.2;

    const totalPageViews = this.dataChunks.totals.pageViews?.sum || 0;

    // Render resources list
    const html = sortedResources.map((resource, index) => {
      const percentage = totalPageViews > 0 ? (resource.weight / totalPageViews) * 100 : 0;
      const frequencyClass = resource.weight >= highThreshold ? 'high-frequency' :
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

  clearSelection() {
    this.selectedHour = null;
    // Restore top-level filters only when returning to overview
    if (this.dataChunks) {
      const baseFilter = {};
      if (this.selectedDeviceType !== 'all') {
        baseFilter.deviceType = [this.selectedDeviceType];
      }
      if (this.selectedSources.length > 0) {
        baseFilter.source = this.selectedSources;
      }
      this.dataChunks.filter = baseFilter;
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
    this.selectedDeviceType = 'all';
    this.selectedSources = [];
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    if (deviceFilter) deviceFilter.value = 'all';
    this.updateSourceChips();
    
    const chart = this.shadowRoot.getElementById('error-chart');
    if (chart) {
      chart.reset();
    }
    const sourceTimeChart = this.shadowRoot.getElementById('source-time-chart');
    if (sourceTimeChart) {
      sourceTimeChart.reset();
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

