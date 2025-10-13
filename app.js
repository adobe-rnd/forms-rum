import DataLoader from './loader.js';
import { fetchDomainKey } from './loader.js';
import { DataChunks, series, facets } from '@adobe/rum-distiller';
import ErrorRateChart from './error-rate-chart.js';

const dataLoader = new DataLoader();
const BUNDLER_ENDPOINT = 'https://bundles.aem.page';
dataLoader.apiEndpoint = BUNDLER_ENDPOINT;
const domain = 'applyonline.hdfcbank.com';
const domainKey = await fetchDomainKey(domain);
dataLoader.domainKey = domainKey;
dataLoader.domain = domain;
const data = await dataLoader.fetchDateRange('2025-10-06', '2025-10-07');
/**
  * Data structure
  * [{
    date: '2025-10-06',
    hour: '00',
    rumBundles: [{bundle}, {bundle}, ...]
  },
  {
    date: '2025-10-06',
    hour: ..,
    rumBundles: [{bundle}, {bundle}, ...]
  },
  ...
  ]
 */

/**
 * Bundle structure
 * {
  url: ...,
  host: ...,
  id: ... // unique id for the bundle,
  time: ... // time of the bundle without the minute information
  timeSlot: '2025-10-06T00:00:00Z', // time information without minutes and seconds
  weight: ... // weight of the bundle as the data is sampled
  userAgent: ... // user agent of the bundle as specified in the documentation
  events: [
    event1,
    event2,
    ...
  ]
}
Reference Documentation:
https://www.aem.live/docs/operational-telemetry

*/

/**
Event structure
  checkpoint: As specified in the documentation
  source: As specified in the documentation
  target: As specified in the documentation
  timeDelta: The time in milliseconds for this event to occur from page load

Reference Documentation:
https://www.aem.live/developer/operational-telemetry

 */

function handleURL() {
  const urlForm = document.getElementById('url-form');
  const urlInput = document.getElementById('url');
  const urlResults = document.getElementById('url-results');

  urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value;

    // Filter bundles by URL
    const filteredData = data.map((chunk) => ({
      date: chunk.date,
      hour: chunk.hour,
      rumBundles: chunk.rumBundles.filter((bundle) => bundle.url === url)
    })).filter((chunk) => chunk.rumBundles.length > 0);

    // Calculate error rate data
    const errorRateData = ErrorRateChart.calculateErrorRate(filteredData);

    // Clear previous results
    urlResults.innerHTML = '';

    if (errorRateData.length === 0) {
      urlResults.innerHTML = '<p>No data found for this URL</p>';
      return;
    }

    // Create and render error rate chart
    const chartComponent = document.createElement('error-rate-chart');
    urlResults.appendChild(chartComponent);
    chartComponent.setData(errorRateData);

    // Display summary statistics
    const totalErrors = errorRateData.reduce((sum, d) => sum + d.totalErrors, 0);
    const totalViews = errorRateData.reduce((sum, d) => sum + d.totalPageViews, 0);
    const avgErrorRate = totalViews > 0 ? (totalErrors / totalViews) * 100 : 0;

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'summary-stats';
    summaryDiv.innerHTML = `
      <h3>Summary Statistics</h3>
      <p><strong>Total Page Views:</strong> ${totalViews}</p>
      <p><strong>Total Errors:</strong> ${totalErrors}</p>
      <p><strong>Average Error Rate:</strong> ${avgErrorRate.toFixed(2)}%</p>
      <p><strong>URL:</strong> ${url}</p>
    `;
    urlResults.appendChild(summaryDiv);
  });
}

handleURL();