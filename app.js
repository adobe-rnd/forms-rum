import DataLoader from './loader.js';
import { fetchDomainKey } from './loader.js';
import { DataChunks, series, facets } from '@adobe/rum-distiller';
import URLAutocomplete from './components/url-autocomplete.js';
import DateRangePicker from './components/date-range-picker.js';
import ErrorDashboard from './dashboards/error-dashboard.js';
import LoadDashboard from './dashboards/load-dashboard.js';
import { errorDataChunks, loadDataChunks } from './datachunks.js';

const dataLoader = new DataLoader();
const BUNDLER_ENDPOINT = 'https://bundles.aem.page';
dataLoader.apiEndpoint = BUNDLER_ENDPOINT;
const domain = 'applyonline.hdfcbank.com';
const domainKey = await fetchDomainKey(domain);
dataLoader.domainKey = domainKey;
dataLoader.domain = domain;

// Initial data load with default date range
let data = await dataLoader.fetchDateRange('2025-10-11', '2025-10-12');

const dataChunks = new DataChunks();
dataChunks.load(data);
dataChunks.addFacet('url', facets.url);
let urls = dataChunks.facets.url.map(url => url.value);

function showLoading() {
  const urlResults = document.getElementById('url-results');
  urlResults.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading data...</p>
    </div>
  `;
}

function hideLoading() {
  const urlResults = document.getElementById('url-results');
  const loadingContainer = urlResults.querySelector('.loading-container');
  if (loadingContainer) {
    loadingContainer.remove();
  }
}

// Track current active dashboard
let currentDashboard = 'errors';

function setupDashboardSwitcher() {
  const errorTab = document.getElementById('tab-errors');
  const loadTab = document.getElementById('tab-load');
  const urlResults = document.getElementById('url-results');

  errorTab.addEventListener('click', () => {
    currentDashboard = 'errors';
    errorTab.classList.add('active');
    loadTab.classList.remove('active');
    urlResults.innerHTML = '<p>Please select a URL to view dashboard</p>';
  });

  loadTab.addEventListener('click', () => {
    currentDashboard = 'load';
    loadTab.classList.add('active');
    errorTab.classList.remove('active');
    urlResults.innerHTML = '<p>Please select a URL to view dashboard</p>';
  });
}

function handleURL() {
  const urlForm = document.getElementById('url-form');
  const urlAutocomplete = document.getElementById('url-autocomplete');
  const urlResults = document.getElementById('url-results');

  // Set the URLs from the facet data to the autocomplete component
  urlAutocomplete.setUrls(urls);
  const dateRangePicker = document.getElementById('date-range-picker');

  // Setup dashboard switcher
  setupDashboardSwitcher();

  dateRangePicker.addEventListener('date-range-changed', async (event) => {
    const { startDate, endDate } = event.detail;

    // Show loading state
    showLoading();

    try {
      // Fetch new data for the date range
      data = await dataLoader.fetchDateRange(startDate, endDate);

      // Update the URLs autocomplete with new data
      const newDataChunks = new DataChunks();
      newDataChunks.load(data);
      newDataChunks.addFacet('url', facets.url);
      const newUrls = newDataChunks.facets.url.map(url => url.value);
      urlAutocomplete.setUrls(newUrls);

      // Clear results after data is loaded
      urlResults.innerHTML = '<p>Please select a URL to view dashboard</p>';
    } catch (error) {
      urlResults.innerHTML = '<p class="error">Error loading data. Please try again.</p>';
      console.error('Error fetching data:', error);
    }
  });



  urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Show loading state
    showLoading();

    const url = urlAutocomplete.getValue();

    try {
      // Filter bundles by URL using text search (substring match)
      const filteredData = data.map((chunk) => ({
        date: chunk.date,
        hour: chunk.hour,
        rumBundles: chunk.rumBundles.filter((bundle) => bundle.url.includes(url))
      })).filter((chunk) => chunk.rumBundles.length > 0);

      // Clear previous results
      urlResults.innerHTML = '';

      // Check if we have data
      if (filteredData.length === 0 || filteredData.every(chunk => chunk.rumBundles.length === 0)) {
        urlResults.innerHTML = '<p>No data found for this URL</p>';
        return;
      }

      // Create and render dashboard based on current selection
      if (currentDashboard === 'errors') {
        const dataChunks = errorDataChunks(filteredData);
        const errorDashboard = document.createElement('error-dashboard');
        urlResults.appendChild(errorDashboard);
        errorDashboard.setData(dataChunks, url);
      } else if (currentDashboard === 'load') {
        const dataChunks = loadDataChunks(filteredData);
        const loadDashboard = document.createElement('load-dashboard');
        urlResults.appendChild(loadDashboard);
        loadDashboard.setData(dataChunks, url);
      }
    } catch (error) {
      urlResults.innerHTML = '<p class="error">Error processing data. Please try again.</p>';
      console.error('Error processing dashboard data:', error);
    }
  });
}

handleURL();