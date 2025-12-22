/**
 * Load Time Dashboard Web Component
 * Displays form block load time statistics with hour-by-hour breakdown
 */
import '../charts/load-time-chart.js';
import '../charts/load-time-histogram.js';
import '../charts/resource-time-table.js';
import '../charts/user-agent-pie-chart.js';

class PerformanceDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.selectedDeviceTypes = new Set(['Mobile: Android', 'Mobile: iOS', 'Mobile: Others', 'Desktop: Windows', 'Desktop: macOS', 'Desktop: Linux', 'Desktop: Others', 'Others']);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
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

        .stat-item.highlight {
          background: #eff6ff;
          border-left-color: #2563eb;
          border-left-width: 5px;
        }

        .stat-item.clickable {
          cursor: pointer;
          transition: all 0.2s;
        }

        .stat-item.clickable:hover {
          background: #dbeafe;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .stat-item.clickable.active {
          background: #2563eb;
          border-left-color: #1e40af;
        }

        .stat-item.clickable.active .stat-label,
        .stat-item.clickable.active .stat-value,
        .stat-item.clickable.active .stat-subtext {
          color: white !important;
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

        .stat-value.fast {
          color: #059669;
        }

        .stat-value.moderate {
          color: #d97706;
        }

        .stat-value.slow {
          color: #dc2626;
        }

        .stat-subtext {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 4px;
        }

        load-time-chart {
          margin-bottom: 24px;
        }

        load-time-histogram {
          margin-top: 32px;
        }

        resource-time-table {
          margin-top: 32px;
        }

        .performance-insights {
          margin-top: 24px;
          padding: 16px;
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
        }

        .performance-insights h3 {
          margin: 0 0 12px 0;
          color: #1e40af;
          font-size: 1rem;
          font-weight: 600;
        }

        .performance-insights p {
          margin: 0;
          color: #374151;
          font-size: 0.875rem;
          line-height: 1.5;
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

        .device-filters-section {
          margin-top: 20px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .device-filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .device-filters-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
        }

        .filters-reset {
          font-size: 0.75rem;
          color: #3b82f6;
          cursor: pointer;
          text-decoration: underline;
        }

        .filters-reset:hover {
          color: #2563eb;
        }

        .device-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .filter-option {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 16px;
          padding: 6px 12px;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s;
        }

        .filter-option:hover {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .filter-option input[type="checkbox"] {
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .user-agent-section {
          margin-top: 24px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .user-agent-section h4 {
          margin: 0 0 16px 0;
          color: #374151;
          font-size: 1rem;
          font-weight: 600;
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
          <h2>Performance</h2>
          <h3>Engagement Readiness Time (Form Visibility)</h3>
          <p class="description">
            How long does it take for the form to be visible on the screen?
          </p>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Fastest (Min)</span>
              <span class="stat-value fast" id="min-load-time">-</span>
            </div>
            <div class="stat-item highlight clickable active" id="stat-p50" data-percentile="p50">
              <span class="stat-label">p50 (Median)</span>
              <span class="stat-value" id="p50-load-time">-</span>
              <span class="stat-subtext">50% of loads are faster</span>
            </div>
            <div class="stat-item highlight clickable" id="stat-p75" data-percentile="p75">
              <span class="stat-label">p75</span>
              <span class="stat-value" id="p75-load-time">-</span>
              <span class="stat-subtext">75% of loads are faster</span>
            </div>
          </div>
        </div>

        <div class="device-filters-section">
          <div class="device-filters-header">
            <span class="device-filters-title">Filter by Device Type:</span>
            <span class="filters-reset" id="reset-filters">Reset All</span>
          </div>
          <div class="device-filters" id="device-filters">
            <label class="filter-option">
              <input type="checkbox" data-device="Mobile: Android" checked />
              Mobile: Android
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Mobile: iOS" checked />
              Mobile: iOS
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Mobile: Others" checked />
              Mobile: Others
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Desktop: Windows" checked />
              Desktop: Windows
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Desktop: macOS" checked />
              Desktop: macOS
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Desktop: Linux" checked />
              Desktop: Linux
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Desktop: Others" checked />
              Desktop: Others
            </label>
            <label class="filter-option">
              <input type="checkbox" data-device="Others" checked />
              Others
            </label>
          </div>
        </div>

        <div class="user-agent-section">
          <h4>Performance by Device Type</h4>
          <user-agent-pie-chart id="user-agent-chart"></user-agent-pie-chart>
        </div>

        <load-time-chart id="load-time-chart"></load-time-chart>

        <load-time-histogram id="load-time-histogram"></load-time-histogram>

        <resource-time-table id="resource-time-table"></resource-time-table>
      </div>
    `;
  }

  setupEventListeners() {
    const statP50 = this.shadowRoot.getElementById('stat-p50');
    const statP75 = this.shadowRoot.getElementById('stat-p75');
    const chart = this.shadowRoot.getElementById('load-time-chart');

    statP50.addEventListener('click', () => {
      statP50.classList.add('active');
      statP75.classList.remove('active');
      chart.setAttribute('percentile', 'p50');
    });

    statP75.addEventListener('click', () => {
      statP75.classList.add('active');
      statP50.classList.remove('active');
      chart.setAttribute('percentile', 'p75');
    });

    // Device type filters
    const filtersContainer = this.shadowRoot.getElementById('device-filters');
    if (filtersContainer) {
      const inputs = Array.from(filtersContainer.querySelectorAll('input[type="checkbox"][data-device]'));
      inputs.forEach((input) => {
        input.addEventListener('change', () => {
          const deviceType = input.getAttribute('data-device');
          if (input.checked) {
            this.selectedDeviceTypes.add(deviceType);
          } else {
            this.selectedDeviceTypes.delete(deviceType);
          }
          this.applyDeviceFilter();
        });
      });
    }

    // Reset filters button
    const resetButton = this.shadowRoot.getElementById('reset-filters');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetDeviceFilters();
      });
    }
  }

  setData(dataChunks, url) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.updateSummaryStats();
    this.updateChart();
    this.updateHistogram();
    this.updateResourceTable();
    this.updateUserAgentChart();
  }

  /**
   * Categorize user agent into device type categories matching the filter options
   * This matches the exact categorization logic from user-agent-pie-chart.js
   */
  categorizeUserAgent(userAgent) {
    const ua = (userAgent || '').toLowerCase();
    
    // Mobile: Android
    if (ua.includes('android')) {
      return 'Mobile: Android';
    }
    
    // Mobile: iOS (iPhone, iPad, iPod, or "mobile:ios" format from RUM data)
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || 
        ua.includes('ios') || (ua.includes('mac') && ua.includes('mobile'))) {
      return 'Mobile: iOS';
    }
    
    // Desktop: Windows
    if (ua.includes('windows')) {
      return 'Desktop: Windows';
    }
    
    // Desktop: macOS
    if (ua.includes('macintosh') || ua.includes('mac os') || 
        (ua.includes('mac') && !ua.includes('mobile'))) {
      return 'Desktop: macOS';
    }
    
    // Desktop: Linux
    if (ua.includes('linux') && !ua.includes('android')) {
      return 'Desktop: Linux';
    }
    
    // Desktop: Others (ChromeOS, generic desktop)
    if (ua.includes('cros') || ua.includes('desktop')) {
      return 'Desktop: Others';
    }
    
    // Mobile: Others (generic mobile devices)
    if (ua.includes('mobile')) {
      return 'Mobile: Others';
    }
    
    // Fallback for completely unknown
    return 'Others';
  }

  applyDeviceFilter() {
    if (!this.dataChunks) return;

    // Get user agent facets
    const userAgentFacets = this.dataChunks.facets.userAgent || [];
    
    // Build list of user agents to filter by
    const selectedUserAgents = [];
    userAgentFacets.forEach(facet => {
      const category = this.categorizeUserAgent(facet.value);
      if (this.selectedDeviceTypes.has(category)) {
        selectedUserAgents.push(facet.value);
      }
    });

    // Apply filter to dataChunks
    if (selectedUserAgents.length > 0 && selectedUserAgents.length < userAgentFacets.length) {
      this.dataChunks.filter = {
        ...this.dataChunks.filter,
        userAgent: selectedUserAgents
      };
    } else {
      // No filter or all selected - remove the filter
      const { userAgent, ...rest } = this.dataChunks.filter || {};
      this.dataChunks.filter = rest;
    }

    // Update all visualizations with filtered data
    this.updateSummaryStats();
    this.updateChart();
    this.updateHistogram();
    this.updateResourceTable();
    this.updateUserAgentChart();
  }

  resetDeviceFilters() {
    // Reset all checkboxes to checked
    const filtersContainer = this.shadowRoot.getElementById('device-filters');
    if (filtersContainer) {
      const inputs = Array.from(filtersContainer.querySelectorAll('input[type="checkbox"][data-device]'));
      inputs.forEach(input => {
        input.checked = true;
        const deviceType = input.getAttribute('data-device');
        this.selectedDeviceTypes.add(deviceType);
      });
    }

    // Clear filter and refresh data
    if (this.dataChunks) {
      const { userAgent, ...rest } = this.dataChunks.filter || {};
      this.dataChunks.filter = rest;
    }
    
    this.applyDeviceFilter();
  }

  updateUserAgentChart() {
    if (!this.dataChunks || !this.dataChunks.facets.userAgent) return;

    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.setData(this.dataChunks.facets.userAgent);
    }
  }

  updateChart() {
    if (!this.dataChunks || !this.dataChunks.facets.hour) return;

    const chart = this.shadowRoot.getElementById('load-time-chart');
    chart.setData(this.dataChunks.facets.hour);
  }

  updateHistogram() {
    if (!this.dataChunks || !this.dataChunks.facets.formBlockLoadTime) return;

    const histogram = this.shadowRoot.getElementById('load-time-histogram');

    // Option 1: Use dynamic buckets (default behavior)
    // histogram.setData(this.dataChunks.facets.formBlockLoadTime);

    // Option 2: Use custom bucket thresholds
    // Example: Create 5 buckets with custom ranges
    const bucketThresholds = [0, 10, 20, 60, Infinity];
    histogram.setData(this.dataChunks.facets.formBlockLoadTime, bucketThresholds);

    // Option 3: Use different number of buckets with custom ranges
    // const bucketThresholds = [0, 1, 2, 5, 10, Infinity];
    // histogram.setData(this.dataChunks.facets.formBlockLoadTime, bucketThresholds);
  }

  updateResourceTable() {
    if (!this.dataChunks) return;

    const resourceTable = this.shadowRoot.getElementById('resource-time-table');
    resourceTable.setData(this.dataChunks);
  }

  updateSummaryStats() {
    if (!this.dataChunks) return;

    const totals = this.dataChunks.totals;
    const minLoadTime = totals.formBlockLoadTime?.min || 0;
    const p50LoadTime = totals.formBlockLoadTime?.percentile(50) || 0;
    const p75LoadTime = totals.formBlockLoadTime?.percentile(75) || 0;
    const lcpP75 = totals.lcp?.percentile(75) || 0;

    const minElement = this.shadowRoot.getElementById('min-load-time');
    minElement.textContent = this.formatTime(minLoadTime);
    minElement.className = 'stat-value ' + this.getPerformanceClass(minLoadTime);

    const p50Element = this.shadowRoot.getElementById('p50-load-time');
    p50Element.textContent = this.formatTime(p50LoadTime);
    p50Element.className = 'stat-value ' + this.getPerformanceClass(p50LoadTime);

    const p75Element = this.shadowRoot.getElementById('p75-load-time');
    p75Element.textContent = this.formatTime(p75LoadTime);
    p75Element.className = 'stat-value ' + this.getPerformanceClass(p75LoadTime);
  }

  getPerformanceClass(loadTime) {
    if (loadTime <= 1) return 'fast';
    if (loadTime <= 2) return 'moderate';
    return 'slow';
  }

  getLCPPerformanceClass(lcpTime) {
    // LCP thresholds based on Core Web Vitals
    if (lcpTime <= 2.5) return 'fast';
    if (lcpTime <= 4) return 'moderate';
    return 'slow';
  }

  getPerformanceLabel(loadTime) {
    if (loadTime <= 1) return 'Excellent';
    if (loadTime <= 2) return 'Good';
    if (loadTime <= 3) return 'Needs Improvement';
    return 'Poor';
  }

  formatTime(seconds) {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
  }

  reset() {
    const chart = this.shadowRoot.getElementById('load-time-chart');
    if (chart) {
      chart.reset();
    }
    const histogram = this.shadowRoot.getElementById('load-time-histogram');
    if (histogram) {
      histogram.reset();
    }
    const resourceTable = this.shadowRoot.getElementById('resource-time-table');
    if (resourceTable) {
      resourceTable.reset();
    }
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      userAgentChart.reset();
    }
    this.dataChunks = null;
    this.url = '';
    this.resetDeviceFilters();
  }
}

// Define the custom element
customElements.define('performance-dashboard', PerformanceDashboard);

export default PerformanceDashboard;

