/**
 * Click Count Chart Web Component
 * Displays hourly click event counts as an interactive line chart
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class ClickCountChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
    this.chartData = null;
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
        }

        .chart-wrapper {
          width: 100%;
        }

        .chart-container {
          position: relative;
          width: 100%;
          height: 300px;
          margin-bottom: 16px;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .chart-container {
            height: 250px;
          }
        }
      </style>

      <div class="chart-wrapper">
        <div class="chart-container">
          <canvas id="click-count-chart"></canvas>
        </div>
      </div>
    `;
  }

  setData(hourFacets) {
    if (!hourFacets || hourFacets.length === 0) {
      this.showNoData();
      return;
    }

    // Ensure canvas exists (may have been removed by showNoData)
    this.ensureCanvas();
    this.renderChart(hourFacets);
  }

  ensureCanvas() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    
    let canvas = this.shadowRoot.getElementById('click-count-chart');
    if (!canvas) {
      container.innerHTML = '<canvas id="click-count-chart"></canvas>';
    }
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
    if (!container) return;
    container.innerHTML = '<div class="no-data">No data available</div>';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  renderChart(hourFacets) {
    // Sort by hour (timeSlot)
    const sortedHours = [...hourFacets].sort((a, b) =>
      new Date(a.value).getTime() - new Date(b.value).getTime()
    );

    const chartData = sortedHours.map(facet => {
      const clickCount = facet.metrics.clickCount?.sum || 0;
      const pageViews = facet.metrics.pageViews?.sum || 0;
      const clicks = facet.metrics.clicks?.sum || 0;

      return {
        hour: this.formatHour(facet.value),
        rawHour: facet.value,
        clickCount,
        pageViews,
        clicks,
        facet
      };
    });

    const canvas = this.shadowRoot.getElementById('click-count-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.hour),
        datasets: [{
          label: 'Click Events',
          data: chartData.map(d => d.clickCount),
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderColor: 'rgba(147, 51, 234, 1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartData.map(d => this.getPointColor(d.clickCount)),
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = chartData[context.dataIndex];
                return [
                  `Click Events: ${data.clickCount}`,
                  `Page Views: ${data.pageViews}`,
                  `Views with Clicks: ${data.clicks}`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Click Events Per Hour',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Click Events'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Hour'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          intersect: false
        }
      }
    });

    // Store chart data for later use
    this.chartData = chartData;
  }

  getPointColor(clickCount) {
    // Color gradient based on click count
    if (clickCount === 0) {
      return 'rgba(156, 163, 175, 1)'; // gray - no clicks
    } else if (clickCount < 20) {
      return 'rgba(192, 132, 252, 1)'; // light purple - low engagement
    } else if (clickCount < 100) {
      return 'rgba(147, 51, 234, 1)'; // purple - good engagement
    } else {
      return 'rgba(126, 34, 206, 1)'; // darker purple - high engagement
    }
  }

  formatHour(timeSlot) {
    const date = new Date(timeSlot);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${month}/${day} ${hour}:00`;
  }

  reset() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.chartData = null;
  }
}

// Define the custom element
customElements.define('click-count-chart', ClickCountChart);

export default ClickCountChart;

