import DataLoader from './loader.js';
import { fetchDomainKey } from './loader.js';
import { DataChunks, series, facets } from '@adobe/rum-distiller';
import URLAutocomplete from './components/url-autocomplete.js';
import ErrorDashboard from './dashboards/error-dashboard.js';

const dataLoader = new DataLoader();
const BUNDLER_ENDPOINT = 'https://bundles.aem.page';
dataLoader.apiEndpoint = BUNDLER_ENDPOINT;
const domain = 'applyonline.hdfcbank.com';
const domainKey = await fetchDomainKey(domain);
dataLoader.domainKey = domainKey;
dataLoader.domain = domain;
const data = await dataLoader.fetchDateRange('2025-10-11');
const dataChunks = new DataChunks();
dataChunks.load(data);
dataChunks.addFacet('url', facets.url);
const urls = dataChunks.facets.url.map(url => url.value);
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
  const urlAutocomplete = document.getElementById('url-autocomplete');
  const urlResults = document.getElementById('url-results');

  // Set the URLs from the facet data to the autocomplete component
  urlAutocomplete.setUrls(urls);

  urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlAutocomplete.getValue();

    // Filter bundles by URL using text search (substring match)
    const filteredData = data.map((chunk) => ({
      date: chunk.date,
      hour: chunk.hour,
      rumBundles: chunk.rumBundles.filter((bundle) => bundle.url.includes(url))
    })).filter((chunk) => chunk.rumBundles.length > 0);

    const dataChunks = new DataChunks();
    dataChunks.load(filteredData);
    dataChunks.addSeries('pageViews', series.pageViews);
    dataChunks.addSeries('errorCount', (bundle) => bundle.events.filter(
      (event) => event.checkpoint === 'error' && event.source !== 'focus-loss'
    ).length, 'every', 'none');
    dataChunks.addFacet('errorSource', (bundle) => {
      return bundle.events
        .filter((event) => event.checkpoint === 'error' && event.source !== 'focus-loss')
        .map((event) => event.source)
        .filter(Boolean); // Remove empty sources
    });
    dataChunks.addFacet('errorTarget', (bundle) => {
      return bundle.events
        .filter((event) => event.checkpoint === 'error' && event.source !== 'focus-loss')
        .map((event) => event.target)
        .filter(Boolean); // Remove empty targets
    });
    dataChunks.addFacet('hour', (bundle) => {
      // Convert UTC timeSlot to local timezone
      // API returns timeSlot in UTC format: '2025-10-06T00:00:00Z'
      // JavaScript Date constructor automatically converts to local timezone
      const utcDate = new Date(bundle.timeSlot);
      // Format as ISO string in local timezone (keeping only date and hour)
      const year = utcDate.getFullYear();
      const month = String(utcDate.getMonth() + 1).padStart(2, '0');
      const day = String(utcDate.getDate()).padStart(2, '0');
      const hour = String(utcDate.getHours()).padStart(2, '0');
      return [`${year}-${month}-${day}T${hour}:00:00`];
    });


    // Clear previous results
    urlResults.innerHTML = '';

    // Check if we have data
    if (dataChunks.bundles.length === 0) {
      urlResults.innerHTML = '<p>No data found for this URL</p>';
      return;
    }

    // Create and render error dashboard
    const errorDashboard = document.createElement('error-dashboard');
    urlResults.appendChild(errorDashboard);
    errorDashboard.setData(dataChunks, url);
  });
}

handleURL();