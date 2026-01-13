/**
 * Error Dashboard Web Component
 * Displays hourly error counts with interactive drill-down into error sources and targets
 */
import '../charts/error-rate-chart.js';
import '../charts/user-agent-pie-chart.js';
import { errorDataChunks } from '../datachunks.js';

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

class ErrorDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dataChunks = null;
    this.rawData = null; // Store raw data for re-filtering
    this.url = '';
    this.selectedHour = null;
    this.selectedResourceTypes = new Set(['image', 'javascript', 'css', 'json', 'others']);
    this.isLoading = true;
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
          position: relative;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 24px;
          margin-bottom: 20px;
        }

        .dashboard-loading-overlay {
          position: absolute;
          inset: 0;
          display: ${this.isLoading ? 'flex' : 'none'};
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.92);
          border-radius: 8px;
          z-index: 10;
        }

        .dashboard-loading-spinner {
          width: 46px;
          height: 46px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #2563eb;
          border-radius: 50%;
          animation: dashboardSpin 1s linear infinite;
        }

        @keyframes dashboardSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .dashboard-loading-text {
          color: #6b7280;
          font-size: 0.95rem;
          font-weight: 600;
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

        /* Status Drilldown Styles */
        .status-drilldown-toggle {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }

        .status-drilldown-toggle:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .status-drilldown-toggle.expanded {
          background: #e0f2fe;
          border-color: #7dd3fc;
        }

        .drilldown-indicator {
          font-size: 0.7rem;
          color: #64748b;
          font-weight: 500;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: monospace;
        }

        .status-badge.status-5xx {
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        .status-badge.status-4xx {
          background: #fef3c7;
          color: #d97706;
          border: 1px solid #fcd34d;
        }

        .status-badge.status-3xx {
          background: #dbeafe;
          color: #2563eb;
          border: 1px solid #93c5fd;
        }

        .status-badge.status-2xx {
          background: #d1fae5;
          color: #059669;
          border: 1px solid #6ee7b7;
        }

        .status-badge.status-error {
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        .status-badge.status-other {
          background: #f3f4f6;
          color: #4b5563;
          border: 1px solid #d1d5db;
        }

        .drilldown-row {
          display: none;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .drilldown-row.visible {
          display: table-row;
        }

        .drilldown-row td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.8125rem;
        }

        .drilldown-bullet {
          text-align: center;
          color: #94a3b8;
          font-size: 1rem;
          width: 40px;
        }

        .drilldown-label {
          color: #475569;
          font-weight: 500;
        }

        .drilldown-count {
          font-weight: 600;
          color: #475569 !important;
        }

        tr.has-drilldown {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        tr.has-drilldown:hover {
          background: #f1f5f9;
        }

        tr.has-drilldown.expanded {
          background: #e0f2fe;
          border-left: 3px solid #0ea5e9;
        }

        tr.has-drilldown.expanded:hover {
          background: #bae6fd;
        }

        tr.has-drilldown td:first-child {
          position: relative;
        }

        tr.has-drilldown.expanded td:first-child::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #0ea5e9;
        }

        .resource-status {
          white-space: nowrap;
        }

        /* Resource Filters Bar - Matching Top-Level Filter Style */
        .resource-filters-bar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 16px 0;
          padding: 16px 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .resource-filters-row {
          display: flex;
          align-items: flex-end;
          gap: 24px;
          flex-wrap: wrap;
        }

        .resource-filter-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
          display: block;
        }

        .type-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .type-filter-option {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .type-filter-option:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .type-filter-option:has(input:checked) {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border-color: #93c5fd;
          color: #1e40af;
        }

        .type-filter-option input[type="checkbox"] {
          width: 12px;
          height: 12px;
          cursor: pointer;
        }

        .resource-filter-select {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8125rem;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 160px;
          color: #334155;
        }

        .resource-filter-select:hover {
          border-color: #94a3b8;
        }

        .resource-filter-select:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
        }

        .active-status-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .status-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid #fcd34d;
          transition: all 0.2s ease;
        }

        .status-chip:hover {
          background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
        }

        .status-chip .remove-status {
          cursor: pointer;
          font-weight: bold;
          font-size: 0.9rem;
          line-height: 1;
          opacity: 0.7;
          transition: opacity 0.2s, color 0.2s;
        }

        .status-chip .remove-status:hover {
          opacity: 1;
          color: #dc2626;
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
        <div id="dashboard-loading-overlay" class="dashboard-loading-overlay" aria-live="polite" aria-busy="${this.isLoading ? 'true' : 'false'}">
          <div class="dashboard-loading-spinner"></div>
          <div class="dashboard-loading-text">Loading Error Dashboard…</div>
        </div>
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
          <div class="resource-filters-bar">
            <div class="resource-filters-row">
              <div class="filter-column">
                <span class="resource-filter-label">Resource Type</span>
                <div class="type-filters" id="resource-filters">
                  <label class="type-filter-option">
                    <input type="checkbox" data-type="image" checked />
                    <span>Image</span>
                  </label>
                  <label class="type-filter-option">
                    <input type="checkbox" data-type="javascript" checked />
                    <span>JS</span>
                  </label>
                  <label class="type-filter-option">
                    <input type="checkbox" data-type="css" checked />
                    <span>CSS</span>
                  </label>
                  <label class="type-filter-option">
                    <input type="checkbox" data-type="json" checked />
                    <span>JSON</span>
                  </label>
                  <label class="type-filter-option">
                    <input type="checkbox" data-type="others" checked />
                    <span>Others</span>
                  </label>
                </div>
              </div>
              <div class="filter-column">
                <span class="resource-filter-label">Status Code</span>
                <select class="resource-filter-select" id="status-filter">
                  <option value="">+ Add Status...</option>
                </select>
              </div>
              <div class="filters-count" id="resources-count"></div>
            </div>
            <div class="active-status-row" id="active-status-row" style="display: none;">
              <span class="active-filters-label">Active Status Filters:</span>
              <div class="status-chips" id="status-chips"></div>
            </div>
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

  updateLoadingOverlay() {
    const overlay = this.shadowRoot?.getElementById('dashboard-loading-overlay');
    if (!overlay) return;
    overlay.style.display = this.isLoading ? 'flex' : 'none';
    overlay.setAttribute('aria-busy', this.isLoading ? 'true' : 'false');
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

  setData(dataChunks, url, rawData) {
    this.dataChunks = dataChunks;
    this.rawData = rawData; // Store raw data for filtering
    this.url = url;
    this.populateTopFilters();
    this.applyTopFilters();
    this.isLoading = false;
    this.updateLoadingOverlay();
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
    const activeFiltersRow = this.shadowRoot.getElementById('active-filters-row');

    chipsContainer.innerHTML = this.selectedDeviceTypes.map(device => {
      return `
        <span class="top-filter-chip device" data-device="${this.escapeHtml(device)}">
          ${this.escapeHtml(device)}
          <span class="remove-chip" data-device="${this.escapeHtml(device)}">×</span>
        </span>
      `;
    }).join('');

    // Show/hide the active filters row based on whether any filters are selected
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

    // Show/hide the active filters row based on whether any filters are selected
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

  applyTopFilters() {
    if (!this.rawData) return;

    // Filter raw data based on selected filters (OR logic for multi-select)
    const hasDeviceFilter = this.selectedDeviceTypes.length > 0;
    const hasSourceFilter = this.selectedSources.length > 0;

    let filteredData = this.rawData;
    
    if (hasDeviceFilter || hasSourceFilter) {
      filteredData = this.rawData.map(chunk => ({
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
    this.dataChunks = errorDataChunks(filteredData);

    // Debug: log filter results
    console.log('Applied filters - Devices:', this.selectedDeviceTypes, 'Sources:', this.selectedSources);
    console.log('Filtered totals:', this.dataChunks.totals);

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
    
    // Use deviceType facet which is already aggregated
    const deviceTypeFacets = this.dataChunks.facets.deviceType || [];
    const totalPageViews = this.dataChunks.totals.pageViews?.sum || 0;
    userAgentChart.setData(deviceTypeFacets, totalPageViews);
  }

  updateStatusChips() {
    const chipsContainer = this.shadowRoot.getElementById('status-chips');
    const activeStatusRow = this.shadowRoot.getElementById('active-status-row');
    if (!chipsContainer) return;

    // Show/hide the active status row
    if (activeStatusRow) {
      activeStatusRow.style.display = this.selectedStatuses.size > 0 ? 'flex' : 'none';
    }

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
    statusFilter.innerHTML = '<option value="">+ Add Status...</option>';
    
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

    // Render user agent pie chart with deviceType facet (already aggregated)
    const userAgentChart = this.shadowRoot.getElementById('user-agent-chart');
    if (userAgentChart) {
      const deviceTypeFacets = this.dataChunks.facets.deviceType || [];
      const totalPV = this.dataChunks.totals.pageViews?.sum || 0;
      userAgentChart.setData(deviceTypeFacets, totalPV);
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

    // Parse the details to get source -> status -> weight mapping
    // Build a map of source -> { status: weight }
    const statusWeightMap = new Map(); // source -> Map(status -> weight)
    const allStatuses = new Set();
    
    missingResourceDetails.forEach(detail => {
      const [source, status] = detail.value.split('|||');
      if (source && status && status.trim()) {
        if (!statusWeightMap.has(source)) {
          statusWeightMap.set(source, new Map());
        }
        const statusMap = statusWeightMap.get(source);
        // Aggregate weight for same source+status combination
        statusMap.set(status, (statusMap.get(status) || 0) + detail.weight);
        allStatuses.add(status);
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
        const statusMap = statusWeightMap.get(res.value);
        if (!statusMap) return false;
        // Check if any of the resource's statuses match selected statuses
        return Array.from(statusMap.keys()).some(s => this.selectedStatuses.has(s));
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

    // Render as table with drilldown
    const tableHeader = `
      <table class="resources-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Resource URL</th>
            <th style="width: 80px;">Type</th>
            <th style="width: 150px;">Status Codes</th>
            <th style="text-align: right; width: 100px;">Count</th>
            <th style="text-align: right; width: 90px;">% of Views</th>
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
      
      // Get status breakdown
      const statusMap = statusWeightMap.get(resource.value);
      const rowId = `drilldown-${index}`;
      let statusDisplay = '-';
      let drilldownRows = '';
      let hasMultipleStatuses = false;
      
      if (statusMap && statusMap.size > 0) {
        // Sort statuses by weight descending
        const sortedStatuses = Array.from(statusMap.entries())
          .sort((a, b) => b[1] - a[1]);
        
        hasMultipleStatuses = sortedStatuses.length > 1;
        
        // Show primary status with expand button if multiple
        const primaryStatus = sortedStatuses[0];
        const isHttpStatus = /^[1-5]\d{2}$/.test(primaryStatus[0]);
        const statusClass = this.getStatusClass(primaryStatus[0]);
        
        if (hasMultipleStatuses) {
          statusDisplay = `
            <div class="status-drilldown-toggle" data-row="${rowId}">
              <span class="status-badge ${statusClass}">${this.escapeHtml(primaryStatus[0])}</span>
              <span class="drilldown-indicator">▼ ${sortedStatuses.length} codes</span>
            </div>
          `;
          
          // Build drilldown rows - cleaner layout
          drilldownRows = sortedStatuses.map(([status, weight], idx) => {
            const statusPct = totalPageViews > 0 ? (weight / totalPageViews) * 100 : 0;
            const sClass = this.getStatusClass(status);
            return `
              <tr class="drilldown-row ${rowId}">
                <td class="drilldown-bullet">•</td>
                <td colspan="2" class="drilldown-label">HTTP ${this.escapeHtml(status)}</td>
                <td><span class="status-badge ${sClass}">${this.escapeHtml(status)}</span></td>
                <td class="resource-count drilldown-count">${weight.toLocaleString()}</td>
                <td class="resource-percentage">${statusPct.toFixed(1)}%</td>
              </tr>
            `;
          }).join('');
        } else {
          // Single status - just show it
          statusDisplay = `<span class="status-badge ${statusClass}">${this.escapeHtml(primaryStatus[0])}</span>`;
        }
      }

      return `
        <tr class="${frequencyClass} ${hasMultipleStatuses ? 'has-drilldown' : ''}" data-row-id="${rowId}">
          <td>${index + 1}</td>
          <td class="resource-url">${this.escapeHtml(resource.value)}</td>
          <td><span class="resource-type-badge ${resourceType}">${resourceType}</span></td>
          <td class="resource-status">${statusDisplay}</td>
          <td class="resource-count ${countClass}">${resource.weight.toLocaleString()}</td>
          <td class="resource-percentage">${percentage.toFixed(1)}%</td>
        </tr>
        ${drilldownRows}
      `;
    }).join('');

    const tableFooter = `
        </tbody>
      </table>
    `;

    container.innerHTML = tableHeader + tableRows + tableFooter;

    // Add click handlers for entire row (single click to toggle, double click also toggles)
    container.querySelectorAll('tr.has-drilldown').forEach(row => {
      const rowId = row.dataset.rowId;
      const toggle = row.querySelector('.status-drilldown-toggle');
      
      // Single click on row to expand/collapse
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking on a link or button inside
        if (e.target.closest('a, button')) return;
        
        const drilldownRows = container.querySelectorAll(`.drilldown-row.${rowId}`);
        const isCurrentlyExpanded = row.classList.contains('expanded');
        const newExpandedState = !isCurrentlyExpanded;
        
        row.classList.toggle('expanded', newExpandedState);
        if (toggle) toggle.classList.toggle('expanded', newExpandedState);
        
        drilldownRows.forEach(dr => {
          dr.classList.toggle('visible', newExpandedState);
        });
        
        // Update indicator
        const indicator = row.querySelector('.drilldown-indicator');
        if (indicator) {
          indicator.textContent = newExpandedState ? '▲ collapse' : `▼ ${drilldownRows.length} codes`;
        }
      });
      
      // Double click to collapse (if expanded)
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('a, button')) return;
        
        const drilldownRows = container.querySelectorAll(`.drilldown-row.${rowId}`);
        
        // Always collapse on double click
        row.classList.remove('expanded');
        if (toggle) toggle.classList.remove('expanded');
        
        drilldownRows.forEach(dr => {
          dr.classList.remove('visible');
        });
        
        // Update indicator to collapsed state
        const indicator = row.querySelector('.drilldown-indicator');
        if (indicator) {
          indicator.textContent = `▼ ${drilldownRows.length} codes`;
        }
      });
    });
  }

  getStatusClass(status) {
    if (/^5\d{2}$/.test(status)) return 'status-5xx';
    if (/^4\d{2}$/.test(status)) return 'status-4xx';
    if (/^3\d{2}$/.test(status)) return 'status-3xx';
    if (/^2\d{2}$/.test(status)) return 'status-2xx';
    if (status.toLowerCase().includes('error') || status.toLowerCase().includes('failed')) return 'status-error';
    return 'status-other';
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

