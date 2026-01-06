/**
 * User Agent Pie Chart Web Component
 * Displays distribution of user agents (device types and OS) as a pie chart
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class UserAgentPieChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
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
          height: 100%;
        }

        .chart-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chart-container {
          position: relative;
          width: 100%;
          height: 350px;
          flex: 1;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }
      </style>

      <div class="chart-wrapper">
        <div class="chart-container">
          <canvas id="user-agent-chart"></canvas>
        </div>
      </div>
    `;
  }

  setData(userAgentFacets) {
    if (!userAgentFacets || userAgentFacets.length === 0) {
      this.showNoData();
      return;
    }

    // Ensure canvas exists (may have been removed by showNoData)
    this.ensureCanvas();
    this.renderChart(userAgentFacets);
  }

  ensureCanvas() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    
    let canvas = this.shadowRoot.getElementById('user-agent-chart');
    if (!canvas) {
      container.innerHTML = '<canvas id="user-agent-chart"></canvas>';
    }
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    container.innerHTML = '<div class="no-data">No user agent data available</div>';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Categorize user agent string into specific Mobile/Desktop subcategories
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

  renderChart(userAgentFacets) {
    // Group user agents into specific categories
    const categoryTotals = {
      'Mobile: Android': 0,
      'Mobile: iOS': 0,
      'Mobile: Others': 0,
      'Desktop: Windows': 0,
      'Desktop: macOS': 0,
      'Desktop: Linux': 0,
      'Desktop: Others': 0,
      'Others': 0
    };

    // Track which user agents fall into each category (for tooltip details)
    const categoryDetails = {
      'Mobile: Android': [],
      'Mobile: iOS': [],
      'Mobile: Others': [],
      'Desktop: Windows': [],
      'Desktop: macOS': [],
      'Desktop: Linux': [],
      'Desktop: Others': [],
      'Others': []
    };

    userAgentFacets.forEach(facet => {
      const category = this.categorizeUserAgent(facet.value);
      categoryTotals[category] += facet.count || 0;
      categoryDetails[category].push({ value: facet.value, count: facet.count || 0 });
    });

    // Store for tooltip access
    this.categoryDetails = categoryDetails;

    // Filter out categories with zero count and convert to array
    const categories = Object.entries(categoryTotals)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) {
      this.showNoData();
      return;
    }

    const labels = categories.map(([label]) => label);
    const data = categories.map(([, count]) => count);
    const total = data.reduce((sum, count) => sum + count, 0);

    // Use specific colors for each category
    const categoryColors = {
      'Mobile: Android': '#10b981',    // green
      'Mobile: iOS': '#6366f1',        // indigo
      'Mobile: Others': '#14b8a6',     // teal
      'Desktop: Windows': '#3b82f6',   // blue
      'Desktop: macOS': '#8b5cf6',     // violet
      'Desktop: Linux': '#f59e0b',     // amber
      'Desktop: Others': '#06b6d4',    // cyan
      'Others': '#9ca3af'              // gray
    };
    const colors = labels.map(label => categoryColors[label] || '#9ca3af');

    const canvas = this.shadowRoot.getElementById('user-agent-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new pie chart
    this.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: {
                size: 12
              },
              padding: 10,
              generateLabels: (chart) => {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => {
                    const value = data.datasets[0].data[i];
                    const percentage = ((value / total) * 100).toFixed(1);
                    return {
                      text: `${label} (${percentage}%)`,
                      fillStyle: data.datasets[0].backgroundColor[i],
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value.toLocaleString()} page views (${percentage}%)`;
              },
              afterLabel: (context) => {
                const label = context.label || '';
                const details = this.categoryDetails[label] || [];
                if (details.length === 0) return '';
                
                // Show top 5 user agents in this category
                const topItems = details
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map(item => `  • ${item.value.substring(0, 40)}${item.value.length > 40 ? '...' : ''}: ${item.count.toLocaleString()}`);
                
                if (details.length > 5) {
                  topItems.push(`  ... and ${details.length - 5} more`);
                }
                
                return topItems;
              }
            }
          },
          title: {
            display: true,
            text: ['Device Breakdown', `Total: ${total.toLocaleString()} weighted page views`],
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: {
              bottom: 10
            }
          },
          subtitle: {
            display: true,
            text: 'Numbers represent estimated page views (sampled data × weight)',
            font: {
              size: 11,
              style: 'italic'
            },
            color: '#6b7280',
            padding: {
              bottom: 8
            }
          }
        }
      }
    });
  }

  generateColors(count) {
    // Generate visually distinct colors for the pie chart
    const baseColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
      '#84cc16', // lime
      '#06b6d4', // cyan
      '#f43f5e', // rose
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  reset() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

// Define the custom element
customElements.define('user-agent-pie-chart', UserAgentPieChart);

export default UserAgentPieChart;

