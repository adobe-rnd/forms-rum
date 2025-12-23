/**
 * Chart.js Plugin: Day/Night Background Shading
 * Adds visual distinction between day and night hours based on user's local timezone
 */

/**
 * Determines if a given hour is during daytime
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @param {Object} options - Configuration options
 * @returns {boolean} true if daytime, false if nighttime
 */
function isDayTime(hour, options = {}) {
  const dayStart = options.dayStart || 6;  // Default: 6 AM
  const dayEnd = options.dayEnd || 20;     // Default: 8 PM
  return hour >= dayStart && hour < dayEnd;
}

/**
 * Day/Night Background Plugin for Chart.js
 */
export const dayNightPlugin = {
  id: 'dayNightBackground',

  beforeDraw: (chart, args, options) => {
    if (!options.enabled) return;

    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const xScale = chart.scales.x;

    if (!chartArea || !xScale) return;

    const dataPoints = chart.data.labels;

    // Save context state
    ctx.save();

    // Get raw hour data from chart metadata
    const rawHourData = chart.config.options.plugins.dayNightBackground.rawHourData || [];

    dataPoints.forEach((label, index) => {
      // Parse the hour from raw data
      let hour;

      if (rawHourData[index]) {
        const date = new Date(rawHourData[index]);
        hour = date.getHours();
      } else {
        // Fallback: try to parse from label (format: "MM/DD HH:00")
        const match = label.match(/(\d{2}):00$/);
        if (match) {
          hour = parseInt(match[1], 10);
        }
      }

      if (hour !== undefined && !isDayTime(hour, options)) {
        // Calculate x position for this data point
        const x1 = xScale.getPixelForValue(index);
        const x2 = index < dataPoints.length - 1
          ? xScale.getPixelForValue(index + 1)
          : chartArea.right;

        // Draw night background
        ctx.fillStyle = options.nightColor || 'rgba(30, 41, 59, 0.08)';
        ctx.fillRect(
          x1,
          chartArea.top,
          x2 - x1,
          chartArea.bottom - chartArea.top
        );
      }
    });

    // Restore context state
    ctx.restore();
  },

  // Add legend items for day/night
  afterDatasetsDraw: (chart, args, options) => {
    if (!options.enabled || !options.showLegend) return;

    const ctx = chart.ctx;
    const chartArea = chart.chartArea;

    // Draw legend at the top right
    const legendX = chartArea.right - 150;
    const legendY = chartArea.top + 10;
    const boxSize = 12;
    const spacing = 8;

    ctx.save();

    // Day indicator
    ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
    ctx.fillRect(legendX, legendY, boxSize, boxSize);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, boxSize, boxSize);

    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('☀️ Day (6AM-8PM)', legendX + boxSize + spacing, legendY + boxSize / 2);

    // Night indicator
    const nightY = legendY + boxSize + spacing + 5;
    ctx.fillStyle = options.nightColor || 'rgba(30, 41, 59, 0.08)';
    ctx.fillRect(legendX, nightY, boxSize, boxSize);
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, nightY, boxSize, boxSize);

    ctx.fillStyle = '#374151';
    ctx.fillText('🌙 Night (8PM-6AM)', legendX + boxSize + spacing, nightY + boxSize / 2);

    ctx.restore();
  },

  defaults: {
    enabled: true,
    dayStart: 6,   // 6 AM
    dayEnd: 20,    // 8 PM
    nightColor: 'rgba(30, 41, 59, 0.08)',
    showLegend: true,
    rawHourData: []
  }
};

/**
 * Helper function to extract hour from various date formats
 * @param {string|Date} dateValue - Date value to parse
 * @returns {number} Hour in 24-hour format (0-23)
 */
export function extractHour(dateValue) {
  if (dateValue instanceof Date) {
    return dateValue.getHours();
  }

  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.getHours();
    }
  }

  return null;
}

export default dayNightPlugin;

