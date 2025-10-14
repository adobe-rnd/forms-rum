/**
 * Fill Count Chart Web Component
 * Displays hourly fill event counts as an interactive line chart
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class FillCountChart extends HTMLElement {
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
          <canvas id="fill-count-chart"></canvas>
        </div>
      </div>
    `;
  }

  setData(hourFacets) {
    if (!hourFacets || hourFacets.length === 0) {
      this.showNoData();
      return;
    }

    this.renderChart(hourFacets);
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.chart-container');
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
      const fillCount = facet.metrics.fillCount?.sum || 0;
      const pageViews = facet.metrics.pageViews?.sum || 0;
      const fills = facet.metrics.fills?.sum || 0;

      return {
        hour: this.formatHour(facet.value),
        rawHour: facet.value,
        fillCount,
        pageViews,
        fills,
        facet
      };
    });

    const canvas = this.shadowRoot.getElementById('fill-count-chart');
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
          label: 'Fill Events',
          data: chartData.map(d => d.fillCount),
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartData.map(d => this.getPointColor(d.fillCount)),
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
                  `Fill Events: ${data.fillCount}`,
                  `Page Views: ${data.pageViews}`,
                  `Views with Fills: ${data.fills}`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Fill Events Per Hour',
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
              text: 'Number of Fill Events'
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

  getPointColor(fillCount) {
    // Color gradient based on fill count
    if (fillCount === 0) {
      return 'rgba(156, 163, 175, 1)'; // gray - no fills
    } else if (fillCount < 10) {
      return 'rgba(234, 179, 8, 1)'; // yellow - low engagement
    } else if (fillCount < 50) {
      return 'rgba(34, 197, 94, 1)'; // green - good engagement
    } else {
      return 'rgba(16, 185, 129, 1)'; // darker green - high engagement
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
customElements.define('fill-count-chart', FillCountChart);

export default FillCountChart;

