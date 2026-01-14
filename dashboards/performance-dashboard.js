/**
 * Load Time Dashboard Web Component
 * Displays form block load time statistics with hour-by-hour breakdown
 */
import '../charts/load-time-chart.js';
import '../charts/load-time-histogram.js';
import '../charts/source-time-series-chart.js';
import '../charts/resource-time-table.js';
import '../charts/user-agent-pie-chart.js';
import '../charts/selector-click-table.js';
import { performanceDataChunks } from '../datachunks.js';

// Helper functions for filtering raw data
// Matches User Agent pie chart categorization for consistency
function categorizeDeviceType(ua) {
  if (!ua) return 'Others';
  const lowerUA = ua.toLowerCase();
  
  // Mobile: Android
  if (lowerUA.includes('android')) return 'Mobile: Android';
  
  // Mobile: iOS (iPhone, iPad, iPod, or "mobile:ios" format from RUM data)
  if (lowerUA.includes('iphone') || lowerUA.includes('ipad') || lowerUA.includes('ipod') || 
      lowerUA.includes('ios') || (lowerUA.includes('mac') && lowerUA.includes('mobile'))) {
    return 'Mobile: iOS';
  }
  
  // Desktop: Windows
  if (lowerUA.includes('windows')) return 'Desktop: Windows';
  
  // Desktop: macOS
  if (lowerUA.includes('macintosh') || lowerUA.includes('mac os') || 
      (lowerUA.includes('mac') && !lowerUA.includes('mobile'))) {
    return 'Desktop: macOS';
  }
  
  // Desktop: Linux (but not Android)
  if (lowerUA.includes('linux') && !lowerUA.includes('android')) return 'Desktop: Linux';
  
  // Desktop: Others (ChromeOS, generic desktop)
  if (lowerUA.includes('cros') || lowerUA.includes('desktop')) return 'Desktop: Others';
  
  // Mobile: Others (generic mobile devices)
  if (lowerUA.includes('mobile')) return 'Mobile: Others';
  
  return 'Others';
}

function normalizeSourceValue(src) {
  try {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const u = new URL(src);
      let path = (u.pathname || '/').replace(/\/+$/, '');
      if (path === '') path = '';
      return `${u.origin}${path}`;
    }
    return src.replace(/\/?#$/, '');
  } catch (e) {
    return src;
  }
}

function getBundleSources(bundle) {
  return bundle.events
    .filter(e => e.checkpoint === 'enter')
    .filter(e => e.source && ['redacted', 'junk_email'].every(s => !e.source.toLowerCase().includes(s)))
    .map(e => normalizeSourceValue(e.source));
}

class PerformanceDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.rawData = null; // Store raw data for re-filtering
    this.url = '';
    this.filteredRawChunks = null;
    // Top-level filter state (both are multi-select, empty = all)
    this.selectedDeviceTypes = [];
    this.selectedSources = [];
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

        .user-agent-section {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 2px solid #e5e7eb;
        }

        .user-agent-section h3 {
          margin: 0 0 16px 0;
          color: #1e40af;
          font-size: 1.25rem;
          font-weight: 600;
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

        /* Top-level Filters Bar - Modern Compact Style */
        .top-filters-bar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
          padding: 16px 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .filters-row {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-column {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .top-filter-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .top-filter-select {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8125rem;
          background: white;
          min-width: 180px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #334155;
        }

        .top-filter-select:hover {
          border-color: #94a3b8;
        }

        .top-filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        .clear-top-filters-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid #dc2626;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #dc2626;
          transition: all 0.2s ease;
          margin-left: auto;
        }

        .clear-top-filters-btn:hover {
          background: #fef2f2;
          border-color: #b91c1c;
          color: #b91c1c;
        }

        .active-filters-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .active-filters-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          white-space: nowrap;
        }

        .all-chips-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .top-filter-chips {
          display: contents;
        }

        .top-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          color: #1e40af;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid #bfdbfe;
          transition: all 0.2s ease;
        }

        .top-filter-chip:hover {
          background: linear-gradient(135deg, #bfdbfe 0%, #c7d2fe 100%);
        }

        .top-filter-chip.device {
          background: linear-gradient(135deg, #d1fae5 0%, #dcfce7 100%);
          color: #065f46;
          border-color: #a7f3d0;
        }

        .top-filter-chip.device:hover {
          background: linear-gradient(135deg, #a7f3d0 0%, #bbf7d0 100%);
        }

        .top-filter-chip .remove-chip {
          cursor: pointer;
          font-weight: bold;
          font-size: 0.9rem;
          line-height: 1;
          opacity: 0.7;
          transition: opacity 0.2s, color 0.2s;
        }

        .top-filter-chip .remove-chip:hover {
          opacity: 1;
          color: #dc2626;
        }

        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      </style>

      <div class="dashboard-container">
        <div class="top-filters-bar" id="top-filters-bar">
          <div class="filters-row">
            <div class="filter-column">
              <span class="top-filter-label">Device Type</span>
              <select class="top-filter-select" id="device-filter">
                <option value="">+ Add Device...</option>
              </select>
            </div>
            <div class="filter-column">
              <span class="top-filter-label">Source</span>
              <select class="top-filter-select" id="source-filter">
                <option value="">+ Add Source...</option>
              </select>
            </div>
            <button class="clear-top-filters-btn" id="clear-top-filters-btn">Clear All</button>
          </div>
          <div class="active-filters-row" id="active-filters-row" style="display: none;">
            <span class="active-filters-label">Active Filters:</span>
            <div class="all-chips-container">
              <div class="top-filter-chips" id="device-chips"></div>
              <div class="top-filter-chips" id="source-chips"></div>
            </div>
          </div>
        </div>

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

        <load-time-chart id="load-time-chart"></load-time-chart>

        <load-time-histogram id="load-time-histogram"></load-time-histogram>

        <div class="dashboard-header" style="margin-top:24px;">
          <h3>By Source Over Time</h3>
          <p class="description">Hourly trend per selected source(s)</p>
        </div>
        <source-time-series-chart id="source-time-series-chart"></source-time-series-chart>

        <resource-time-table id="resource-time-table"></resource-time-table>

        <div class="user-agent-section">
          <h3>User Agent Distribution</h3>
          <div class="chart-section">
            <h4>Device Breakdown</h4>
            <user-agent-pie-chart id="user-agent-chart"></user-agent-pie-chart>
          </div>
        </div>

        <selector-click-table id="selector-click-table"></selector-click-table>
      </div>
    `;
  }

  setupEventListeners() {
    const statP50 = this.shadowRoot.getElementById('stat-p50');
    const statP75 = this.shadowRoot.getElementById('stat-p75');
    const chart = this.shadowRoot.getElementById('load-time-chart');
    const sourceSeriesChart = this.shadowRoot.getElementById('source-time-series-chart');

    statP50.addEventListener('click', () => {
      statP50.classList.add('active');
      statP75.classList.remove('active');
      chart.setAttribute('percentile', 'p50');
      sourceSeriesChart.setAttribute('percentile', 'p50');
    });

    statP75.addEventListener('click', () => {
      statP75.classList.add('active');
      statP50.classList.remove('active');
      chart.setAttribute('percentile', 'p75');
      sourceSeriesChart.setAttribute('percentile', 'p75');
    });

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

  setData(dataChunks, url, rawChunks, aliasMap) {
    this.dataChunks = dataChunks;
    this.url = url;
    this.rawChunks = rawChunks; // This is our raw data for filtering
    this.aliasMap = aliasMap || null;
    this.populateTopFilters();
    this.applyTopFilters();
  }

  populateTopFilters() {
    if (!this.dataChunks) return;

    // Populate device type filter - use weight for consistency with User Agent chart
    const deviceFilter = this.shadowRoot.getElementById('device-filter');
    const deviceTypes = this.dataChunks.facets.deviceType || [];
    
    deviceFilter.innerHTML = '<option value="">+ Add Device...</option>';
    deviceTypes
      .sort((a, b) => b.weight - a.weight)
      .forEach(dt => {
        const option = document.createElement('option');
        option.value = dt.value;
        // Use weight (extrapolated page views) for consistency
        option.textContent = `${dt.value} (${dt.weight.toLocaleString()})`;
        deviceFilter.appendChild(option);
      });

    // Populate source filter - use weight for consistency
    const sourceFilter = this.shadowRoot.getElementById('source-filter');
    const sources = this.dataChunks.facets.source || [];
    
    sourceFilter.innerHTML = '<option value="">+ Add Source...</option>';
    sources
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 50)
      .forEach(src => {
        const option = document.createElement('option');
        option.value = src.value;
        const displayText = src.value.length > 60 
          ? src.value.substring(0, 57) + '...' 
          : src.value;
        // Use weight (extrapolated page views) for consistency
        option.textContent = `${displayText} (${src.weight.toLocaleString()})`;
        sourceFilter.appendChild(option);
      });

    this.updateDeviceChips();
    this.updateSourceChips();
  }

  updateDeviceChips() {
    const chipsContainer = this.shadowRoot.getElementById('device-chips');

    chipsContainer.innerHTML = this.selectedDeviceTypes.map(device => {
      return `
        <span class="top-filter-chip device" data-device="${this.escapeHtml(device)}">
          ${this.escapeHtml(device)}
          <span class="remove-chip" data-device="${this.escapeHtml(device)}">×</span>
        </span>
      `;
    }).join('');

    // Show/hide the active filters row
    this.updateActiveFiltersVisibility();

    chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const deviceToRemove = e.target.dataset.device;
        this.selectedDeviceTypes = this.selectedDeviceTypes.filter(d => d !== deviceToRemove);
        this.updateDeviceChips();
        this.applyTopFilters();
      });
    });
  }

  updateActiveFiltersVisibility() {
    const activeFiltersRow = this.shadowRoot.getElementById('active-filters-row');
    const hasFilters = this.selectedDeviceTypes.length > 0 || this.selectedSources.length > 0;
    activeFiltersRow.style.display = hasFilters ? 'flex' : 'none';
  }

  updateSourceChips() {
    const chipsContainer = this.shadowRoot.getElementById('source-chips');

    chipsContainer.innerHTML = this.selectedSources.map(src => {
      const displayText = src.length > 35 ? src.substring(0, 32) + '...' : src;
      return `
        <span class="top-filter-chip" data-source="${this.escapeHtml(src)}" title="${this.escapeHtml(src)}">
          ${this.escapeHtml(displayText)}
          <span class="remove-chip" data-source="${this.escapeHtml(src)}">×</span>
        </span>
      `;
    }).join('');

    // Show/hide the active filters row
    this.updateActiveFiltersVisibility();

    chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sourceToRemove = e.target.dataset.source;
        this.selectedSources = this.selectedSources.filter(s => s !== sourceToRemove);
        this.updateSourceChips();
        this.applyTopFilters();
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  applyTopFilters() {
    if (!this.rawChunks) return;

    // Filter raw data based on selected filters (OR logic for multi-select)
    const hasDeviceFilter = this.selectedDeviceTypes.length > 0;
    const hasSourceFilter = this.selectedSources.length > 0;

    let filteredData = this.rawChunks;
    
    if (hasDeviceFilter || hasSourceFilter) {
      filteredData = this.rawChunks.map(chunk => ({
        ...chunk,
        rumBundles: chunk.rumBundles.filter(bundle => {
          // Device type filter (OR logic - match ANY selected device type)
          let passesDeviceFilter = true;
          if (hasDeviceFilter) {
            const bundleDeviceType = categorizeDeviceType(bundle.userAgent);
            passesDeviceFilter = this.selectedDeviceTypes.includes(bundleDeviceType);
          }
          
          // Source filter (OR logic - match ANY selected source)
          let passesSourceFilter = true;
          if (hasSourceFilter) {
            const bundleSources = getBundleSources(bundle);
            passesSourceFilter = bundleSources.some(src => this.selectedSources.includes(src));
          }
          
          return passesDeviceFilter && passesSourceFilter;
        })
      })).filter(chunk => chunk.rumBundles.length > 0);
    }

    // Re-create DataChunks with filtered data
    this.dataChunks = performanceDataChunks(filteredData);
    this.filteredRawChunks = filteredData;

    // Debug: log filter results
    console.log('Applied filters - Devices:', this.selectedDeviceTypes, 'Sources:', this.selectedSources);
    console.log('Filtered totals:', this.dataChunks.totals);

    // Update all panels with filtered data
    this.updateSummaryStats();
    this.updateChart();
    this.updateHistogram();
    this.updateResourceTable();
    this.updateUserAgentChart();
    this.updateSelectorClickTable();
  }

  updateSelectorClickTable() {
    const table = this.shadowRoot.getElementById('selector-click-table');
    if (!table) return;
    const chunks = Array.isArray(this.filteredRawChunks) ? this.filteredRawChunks : [];
    const bundles = chunks.flatMap((c) => c.rumBundles || []);
    if (table.setData) {
      table.setData(bundles, this.url);
    }
  }

  updateUserAgentChart() {
    if (!this.dataChunks) return;
    const uaChart = this.shadowRoot.getElementById('user-agent-chart');
    if (!uaChart) return;
    // Use deviceType facet which is already aggregated and matches Total Page Views
    const deviceTypeFacets = this.dataChunks.facets.deviceType || [];
    const totalPageViews = this.dataChunks.totals.pageViews?.sum || 0;
    uaChart.setData(deviceTypeFacets, totalPageViews);
  }

  updateChart() {
    if (!this.dataChunks || !this.dataChunks.facets.hour) return;
    const chart = this.shadowRoot.getElementById('load-time-chart');
    if (!chart) return;
    chart.setData(this.dataChunks.facets.hour);

    const bundles = Array.isArray(this.rawChunks)
      ? this.rawChunks.flatMap((c) => c.rumBundles || [])
      : [];

    const sourceSeriesChart = this.shadowRoot.getElementById('source-time-series-chart');
    if (bundles.length) {
      if (this.aliasMap && sourceSeriesChart.setAliasMap) {
        sourceSeriesChart.setAliasMap(this.aliasMap);
      }
      sourceSeriesChart.setFromBundles(bundles);
    } else {
      sourceSeriesChart.reset();
    }
  }

  updateHistogram() {
    if (!this.dataChunks || !this.dataChunks.facets.formBlockLoadTime) return;
    const histogram = this.shadowRoot.getElementById('load-time-histogram');
    if (!histogram) return;

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
    // Reset filter state
    this.selectedDeviceTypes = [];
    this.selectedSources = [];
    this.updateDeviceChips();
    this.updateSourceChips();

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
    const selectorClickTable = this.shadowRoot.getElementById('selector-click-table');
    if (selectorClickTable && selectorClickTable.reset) {
      selectorClickTable.reset();
    }
    this.dataChunks = null;
    this.url = '';
    this.filteredRawChunks = null;
  }
}

// Define the custom element
customElements.define('performance-dashboard', PerformanceDashboard);

export default PerformanceDashboard;
