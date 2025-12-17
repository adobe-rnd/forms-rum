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

    this.renderChart(userAgentFacets);
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
    container.innerHTML = '<div class="no-data">No user agent data available</div>';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Categorize user agent string into Mobile or Desktop
   */
  categorizeUserAgent(userAgent) {
    const ua = (userAgent || '').toLowerCase();
    
    // Mobile detection: Android, iOS (iPhone, iPad, iPod)
    if (ua.includes('android') || 
        ua.includes('iphone') || 
        ua.includes('ipad') || 
        ua.includes('ipod') ||
        ua.includes('mobile')) {
      return 'Mobile (Android/iOS)';
    }
    
    // Desktop: Windows, Mac, Linux
    if (ua.includes('windows') || 
        ua.includes('macintosh') || 
        ua.includes('mac os') ||
        ua.includes('linux') ||
        ua.includes('cros')) {
      return 'Desktop (Windows/Mac)';
    }
    
    // Fallback for unknown
    return 'Other';
  }

  renderChart(userAgentFacets) {
    // Group user agents into Mobile and Desktop categories
    const categoryTotals = {
      'Mobile (Android/iOS)': 0,
      'Desktop (Windows/Mac)': 0,
      'Other': 0
    };

    userAgentFacets.forEach(facet => {
      const category = this.categorizeUserAgent(facet.value);
      categoryTotals[category] += facet.count || 0;
    });

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
      'Mobile (Android/iOS)': '#10b981',    // green
      'Desktop (Windows/Mac)': '#3b82f6',   // blue
      'Other': '#9ca3af'                     // gray
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
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          },
          title: {
            display: true,
            text: 'Device Breakdown',
            font: {
              size: 16,
              weight: 'bold'
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

