/**
 * Load Time Histogram Web Component
 * Displays distribution of form block load times in 5 dynamic buckets
 */
import { Chart, registerables } from 'chartjs';

// Register Chart.js components
Chart.register(...registerables);

class LoadTimeHistogram extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.chart = null;
    this.histogramData = null;
    this.bucketThresholds = null;
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

        .histogram-wrapper {
          width: 100%;
        }

        .histogram-header {
          margin-bottom: 16px;
        }

        .histogram-header h3 {
          margin: 0 0 8px 0;
          color: #1e40af;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .histogram-description {
          color: #6b7280;
          font-size: 0.875rem;
          margin: 0;
        }

        .histogram-container {
          position: relative;
          width: 100%;
          height: 350px;
          margin-bottom: 16px;
        }

        .histogram-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 16px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .histogram-stat {
          display: flex;
          flex-direction: column;
        }

        .histogram-stat-label {
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .histogram-stat-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .histogram-container {
            height: 300px;
          }

          .histogram-stats {
            grid-template-columns: 1fr 1fr;
          }
        }
      </style>

      <div class="histogram-wrapper">
        <div class="histogram-header">
          <h3>Engagement Readiness Time (Form Visibility)Distribution</h3>
        </div>

        <div class="histogram-container">
          <canvas id="histogram-chart"></canvas>
        </div>

        <div class="histogram-stats" id="histogram-stats"></div>
      </div>
    `;
  }

  /**
   * Set the data for the histogram
   * @param {Array} formBlockLoadTimeFacet - Array of facet objects with value and weight
   * @param {Array} bucketThresholds - Optional array of threshold values (e.g., [0, 0.5, 1, 2, 3, Infinity])
   *                                    If provided, creates buckets based on these thresholds
   *                                    If not provided, creates 5 equal-width buckets dynamically
   */
  setData(formBlockLoadTimeFacet, bucketThresholds = null) {
    if (!formBlockLoadTimeFacet || formBlockLoadTimeFacet.length === 0) {
      this.showNoData();
      return;
    }

    // Ensure canvas exists (may have been removed by showNoData)
    this.ensureCanvas();
    this.bucketThresholds = bucketThresholds;
    this.processData(formBlockLoadTimeFacet);
    this.renderChart();
  }

  ensureCanvas() {
    const container = this.shadowRoot.querySelector('.histogram-container');
    if (!container) return;
    
    let canvas = this.shadowRoot.getElementById('histogram-chart');
    if (!canvas) {
      container.innerHTML = '<canvas id="histogram-chart"></canvas>';
    }
  }

  showNoData() {
    const container = this.shadowRoot.querySelector('.histogram-container');
    if (!container) return;
    container.innerHTML = '<div class="no-data">No load time data available</div>';

    const statsContainer = this.shadowRoot.getElementById('histogram-stats');
    if (statsContainer) statsContainer.style.display = 'none';

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  processData(formBlockLoadTimeFacet) {
    // Extract and parse all load time values
    const loadTimes = [];
    const weights = [];

    formBlockLoadTimeFacet.forEach(facet => {
      const timeValue = parseFloat(facet.value.replace('s', ''));
      if (!isNaN(timeValue)) {
        loadTimes.push(timeValue);
        weights.push(facet.weight || 1);
      }
    });

    if (loadTimes.length === 0) {
      this.showNoData();
      return;
    }

    // Calculate min and max
    const min = Math.min(...loadTimes);
    const max = Math.max(...loadTimes);

    let buckets = [];

    if (this.bucketThresholds && Array.isArray(this.bucketThresholds) && this.bucketThresholds.length >= 2) {
      // Use custom thresholds
      buckets = this.createBucketsFromThresholds(loadTimes, weights, this.bucketThresholds);
    } else {
      // Create 5 dynamic buckets
      buckets = this.createDynamicBuckets(loadTimes, weights, min, max);
    }

    // Calculate percentages
    const totalWeightedCount = buckets.reduce((sum, b) => sum + b.weightedCount, 0);
    buckets.forEach(bucket => {
      bucket.percentage = totalWeightedCount > 0
        ? (bucket.weightedCount / totalWeightedCount) * 100
        : 0;
    });

    this.histogramData = {
      buckets,
      totalCount: loadTimes.length,
      totalWeightedCount,
      min,
      max,
      mean: loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length,
      median: this.calculateMedian(loadTimes)
    };
  }

  createBucketsFromThresholds(loadTimes, weights, thresholds) {
    const buckets = [];

    // Sort thresholds to ensure they're in order
    const sortedThresholds = [...thresholds].sort((a, b) => a - b);

    // Create buckets from consecutive threshold pairs
    for (let i = 0; i < sortedThresholds.length - 1; i++) {
      const bucketMin = sortedThresholds[i];
      const bucketMax = sortedThresholds[i + 1];

      // Count values in this bucket
      let count = 0;
      let weightedCount = 0;

      loadTimes.forEach((time, idx) => {
        if (bucketMax === Infinity) {
          // Last bucket with infinity: inclusive of min, no upper bound
          if (time >= bucketMin) {
            count++;
            weightedCount += weights[idx];
          }
        } else if (i === sortedThresholds.length - 2) {
          // Last bucket (but not infinity): inclusive of both ends
          if (time >= bucketMin && time <= bucketMax) {
            count++;
            weightedCount += weights[idx];
          }
        } else {
          // Other buckets: [min, max)
          if (time >= bucketMin && time < bucketMax) {
            count++;
            weightedCount += weights[idx];
          }
        }
      });

      // Create label
      let label;
      if (bucketMax === Infinity) {
        label = `${this.formatTime(bucketMin)}+`;
      } else {
        label = `${this.formatTime(bucketMin)} - ${this.formatTime(bucketMax)}`;
      }

      buckets.push({
        min: bucketMin,
        max: bucketMax,
        label: label,
        count: count,
        weightedCount: weightedCount,
        percentage: 0 // Will calculate after
      });
    }

    return buckets;
  }

  createDynamicBuckets(loadTimes, weights, min, max) {
    const buckets = [];
    const numBuckets = 5;
    const bucketWidth = (max - min) / numBuckets;

    // Handle edge case where all values are the same
    if (bucketWidth === 0) {
      // All values are the same, create a single bucket
      buckets.push({
        min: min,
        max: min,
        label: this.formatTime(min),
        count: loadTimes.length,
        weightedCount: weights.reduce((sum, w) => sum + w, 0),
        percentage: 100
      });
    } else {
      // Create 5 equal-width buckets
      for (let i = 0; i < numBuckets; i++) {
        const bucketMin = min + (i * bucketWidth);
        const bucketMax = i === numBuckets - 1 ? max : min + ((i + 1) * bucketWidth);

        // Count values in this bucket
        let count = 0;
        let weightedCount = 0;

        loadTimes.forEach((time, idx) => {
          if (i === numBuckets - 1) {
            // Last bucket: inclusive of max
            if (time >= bucketMin && time <= bucketMax) {
              count++;
              weightedCount += weights[idx];
            }
          } else {
            // Other buckets: [min, max)
            if (time >= bucketMin && time < bucketMax) {
              count++;
              weightedCount += weights[idx];
            }
          }
        });

        buckets.push({
          min: bucketMin,
          max: bucketMax,
          label: `${this.formatTime(bucketMin)} - ${this.formatTime(bucketMax)}`,
          count: count,
          weightedCount: weightedCount,
          percentage: 0 // Will calculate after we have all counts
        });
      }
    }

    return buckets;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  generateColors(numBuckets) {
    // Generate neutral blue shades for any number of buckets
    const baseColors = [];
    const borderColors = [];

    for (let i = 0; i < numBuckets; i++) {
      // Create a gradient from darker to lighter blue and back
      const position = i / Math.max(numBuckets - 1, 1);
      const intensity = 0.5 + 0.5 * Math.sin(position * Math.PI); // Creates bell curve

      // Base color with varying opacity
      const r = Math.round(59 + (147 - 59) * intensity);
      const g = Math.round(130 + (197 - 130) * intensity);
      const b = Math.round(246 + (253 - 246) * intensity);

      baseColors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);

      // Border color (darker version)
      const br = Math.round(r * 0.7);
      const bg = Math.round(g * 0.85);
      const bb = Math.round(b * 0.95);
      borderColors.push(`rgba(${br}, ${bg}, ${bb}, 1)`);
    }

    return { baseColors, borderColors };
  }

  renderChart() {
    if (!this.histogramData) return;

    const canvas = this.shadowRoot.getElementById('histogram-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const { buckets } = this.histogramData;

    // Create gradient colors (neutral blue shades)
    // Generate colors dynamically based on number of buckets
    const { baseColors, borderColors } = this.generateColors(buckets.length);

    // Create new chart
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{
          label: 'Number of Loads',
          data: buckets.map(b => b.weightedCount),
          backgroundColor: baseColors,
          borderColor: borderColors,
          borderWidth: 2
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
                const bucket = buckets[context.dataIndex];
                return [
                  `Count: ${bucket.weightedCount.toLocaleString()}`,
                  `Percentage: ${bucket.percentage.toFixed(1)}%`,
                  `Range: ${bucket.label}`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Engagement Readiness Time (Form Visibility) Distribution',
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
              text: 'Number of Views'
            },
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          },
          x: {
            title: {
              display: true,
              text: 'Time Range'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });

    this.renderStats();
  }

  renderStats() {
    if (!this.histogramData) return;

    const statsContainer = this.shadowRoot.getElementById('histogram-stats');
    statsContainer.style.display = 'grid';

    const { min, max, mean, median, totalWeightedCount } = this.histogramData;

    statsContainer.innerHTML = `
      <div class="histogram-stat">
        <span class="histogram-stat-label">Total Views</span>
        <span class="histogram-stat-value">${totalWeightedCount.toLocaleString()}</span>
      </div>
      <div class="histogram-stat">
        <span class="histogram-stat-label">Min View Time</span>
        <span class="histogram-stat-value">${this.formatTime(min)}</span>
      </div>
      <div class="histogram-stat">
        <span class="histogram-stat-label">Max View Time</span>
        <span class="histogram-stat-value">${this.formatTime(max)}</span>
      </div>
      <div class="histogram-stat">
        <span class="histogram-stat-label">Mean (Average)</span>
        <span class="histogram-stat-value">${this.formatTime(mean)}</span>
      </div>
      <div class="histogram-stat">
        <span class="histogram-stat-label">Median</span>
        <span class="histogram-stat-value">${this.formatTime(median)}</span>
      </div>
    `;
  }

  formatTime(seconds) {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(0)}s`;
  }

  reset() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.histogramData = null;
  }
}

// Define the custom element
customElements.define('load-time-histogram', LoadTimeHistogram);

export default LoadTimeHistogram;

