/*
 * This module should handle all of the loading of bundles. Ideally it would work
 * offline, so it should be a service worker. We will migrate code from the main
 * file to here.
 */
import { utils } from '@adobe/rum-distiller';

const { addCalculatedProps } = utils;

function getPersistentToken() {
  return localStorage.getItem('rum-bundler-token');
}

export async function fetchDomainKey(domain) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const domainKey = urlParams.get('domainkey');
    if (domainKey) {
      return domainKey;
    }
    const auth = getPersistentToken();
    let org;
    if (domain.endsWith(':all') && domain !== 'aem.live:all') {
      ([org] = domain.split(':'));
    }
    const issueResp = await fetch(`https://bundles.aem.page/${org ? `orgs/${org}/key` : `domainkey/${domain}`}`, {
      headers: {
        authorization: `Bearer ${auth}`,
      },
    });
    let domainkey = '';
    try {
      domainkey = (await issueResp.json())[org ? 'orgkey' : 'domainkey'];
    } catch (e) {
      // no domainkey
    }
    if (issueResp.status === 403 || domainkey === '') {
      // you don't have an admin key
      // let's see if we can get access anyway
      const n = new Date();
      const y = n.getFullYear();
      const m = String(n.getMonth() + 1).padStart(2, '0');
      const d = String(n.getDate()).padStart(2, '0');
      const probeResp = await fetch(`https://bundles.aem.page/bundles/${domain}/${y}/${m}/${d}?domainkey=open`);
      if (probeResp.status === 200) {
        return 'open';
      }
    }
    return domainkey;
  } catch (e) {
    return 'error';
  }
}


export default class DataLoader {
  constructor() {
    this.cache = new Map();
    this.API_ENDPOINT = 'https://bundles.aem.page';
    this.DOMAIN = 'www.thinktanked.org';
    this.DOMAIN_KEY = undefined;
    this.ORG = undefined;
    this.SCOPE = undefined; // unused
    this.granularity = 'month';
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.useCache = false; // enable/disable IndexedDB caching
    this.DB_NAME = 'rum-bundles-db';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'bundles-cache';
    this.dbPromise = null;
    this.dbInitialized = false;
  }

  /**
   * Initializes the IndexedDB database
   * @returns {Promise<IDBDatabase>} - Promise resolving to the database instance
   */
  async initDB() {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB is not supported in this browser');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.dbInitialized = true;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const objectStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'url' });
          // Create index on timestamp for efficient cleanup of expired entries
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async flush() {
    this.cache.clear();
    await this.clearCache();
  }

  /**
   * Clears all cached entries from IndexedDB
   */
  async clearCache() {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.STORE_NAME);
      objectStore.clear();

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.warn('Failed to clear IndexedDB cache:', e);
    }
  }

  /**
   * Removes expired entries from the cache
   */
  async cleanupExpiredCache() {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.STORE_NAME);
      const index = objectStore.index('timestamp');
      const now = Date.now();
      const expiredThreshold = now - this.cacheExpiration;

      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < expiredThreshold) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (e) {
      console.warn('Failed to cleanup expired cache:', e);
    }
  }

  /**
   * Retrieves cached data from IndexedDB if available and not expired
   * @param {string} url - The API URL used as cache key
   * @returns {Promise<object|null>} - Cached data or null if not found/expired
   */
  async getCachedData(url) {
    if (!this.useCache) {
      return null;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(this.STORE_NAME);
      const request = objectStore.get(url);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;

          if (!result) {
            resolve(null);
            return;
          }

          const now = Date.now();

          // Check if cache has expired
          if (now - result.timestamp > this.cacheExpiration) {
            // Delete expired entry
            this.deleteCachedData(url);
            resolve(null);
            return;
          }

          resolve(result.data);
        };

        request.onerror = () => {
          console.warn('Failed to retrieve cached data:', request.error);
          resolve(null);
        };
      });
    } catch (e) {
      console.warn('Failed to access IndexedDB:', e);
      return null;
    }
  }

  /**
   * Stores data in IndexedDB with current timestamp
   * @param {string} url - The API URL used as cache key
   * @param {object} data - The data to cache
   */
  async setCachedData(url, data) {
    if (!this.useCache) {
      return;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.STORE_NAME);

      const cacheItem = {
        url,
        data,
        timestamp: Date.now(),
      };

      const request = objectStore.put(cacheItem);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn('Failed to cache data:', request.error);
          // If quota exceeded, try to cleanup old entries
          if (request.error.name === 'QuotaExceededError') {
            this.cleanupExpiredCache().then(() => {
              // Retry after cleanup
              objectStore.put(cacheItem);
            });
          }
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('Failed to cache data:', e);
    }
  }

  /**
   * Deletes a specific cached entry
   * @param {string} url - The API URL to delete from cache
   */
  async deleteCachedData(url) {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.STORE_NAME);
      objectStore.delete(url);
    } catch (e) {
      console.warn('Failed to delete cached data:', e);
    }
  }

  set domainKey(key) {
    this.DOMAIN_KEY = key;
  }

  set domain(domain) {
    this.DOMAIN = domain;
  }

  set apiEndpoint(endpoint) {
    this.API_ENDPOINT = endpoint;
  }

  apiURL(datePath, hour) {
    const u = new URL(this.API_ENDPOINT);
    u.pathname = [
      'bundles',
      this.DOMAIN,
      datePath,
      hour,
    ]
      .filter((p) => !!p) // remove empty strings
      .join('/');
    u.searchParams.set('domainkey', this.DOMAIN_KEY);
    return u.toString();
  }

  // eslint-disable-next-line class-methods-use-this
  filterByDateRange(data, start, end) {
    if (start || end) {
      const filtered = data.filter((bundle) => {
        const time = new Date(bundle.timeSlot);
        return ((start ? time >= start : true) && (end ? time <= end : true));
      });
      return filtered;
    }
    return data;
  }

  async fetchUTCMonth(utcISOString, start, end) {
    this.granularity = 'month';
    const [date] = utcISOString.split('T');
    const dateSplits = date.split('-');
    dateSplits.pop();
    const monthPath = dateSplits.join('/');
    if (this.DOMAIN_KEY === undefined) {
      return {date, rumBundles: []};
    }
    const apiRequestURL = this.apiURL(monthPath);

    // Check cache first
    const cachedData = await this.getCachedData(apiRequestURL);
    if (cachedData) {
      return { date, rumBundles: this.filterByDateRange(cachedData.rumBundles, start, end) };
    }

    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    if (!resp.ok) {
      return { date, rumBundles: [] };
    }
    let json;
    try {
      json = await resp.json();
    } catch (e) {
      return { date, rumBundles: [] };
    }
    const { rumBundles } = json || { rumBundles: [] };
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

    // Store in cache (don't await to avoid blocking)
    // this.setCachedData(apiRequestURL, { rumBundles });

    return { date, rumBundles: this.filterByDateRange(rumBundles, start, end) };
  }

  async fetchUTCDay(utcISOString, start, end) {
    this.granularity = 'day';
    const [date] = utcISOString.split('T');
    const datePath = date.split('-').join('/');
    const apiRequestURL = this.apiURL(datePath);
    if (this.DOMAIN_KEY === undefined) {
      return {date, rumBundles: []};
    }

    // Check cache first
    const cachedData = await this.getCachedData(apiRequestURL);
    if (cachedData) {
      return { date, rumBundles: this.filterByDateRange(cachedData.rumBundles, start, end) };
    }

    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    if (!resp.ok) {
      return { date, rumBundles: [] };
    }
    let json;
    try {
      json = await resp.json();
    } catch (e) {
      return { date, rumBundles: [] };
    }
    const { rumBundles } = json || { rumBundles: [] };
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

    // Store in cache (don't await to avoid blocking)
    // this.setCachedData(apiRequestURL, { rumBundles });

    return { date, rumBundles: this.filterByDateRange(rumBundles, start, end) };
  }

  async fetchUTCHour(utcISOString, start, end) {
    this.granularity = 'hour';
    const [date, time] = utcISOString.split('T');
    const datePath = date.split('-').join('/');
    const hour = time.split(':')[0];
    const apiRequestURL = this.apiURL(datePath, hour);
    if (this.DOMAIN_KEY === undefined) {
      return {date, hour, rumBundles: []};
    }

    // Check cache first
    const cachedData = await this.getCachedData(apiRequestURL);
    if (cachedData) {
      return { date, hour, rumBundles: this.filterByDateRange(cachedData.rumBundles, start, end) };
    }

    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    if (!resp.ok) {
      return { date, hour, rumBundles: [] };
    }
    let json;
    try {
      json = await resp.json();
    } catch (e) {
      return { date, hour, rumBundles: [] };
    }
    const { rumBundles } = json || { rumBundles: [] };
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

    // do not cache if the date is today
    if (date !== new Date().toISOString().split('T')[0]) {
      // Store in cache (don't await to avoid blocking)
      // this.setCachedData(apiRequestURL, { rumBundles });
    }

    return { date, hour, rumBundles: this.filterByDateRange(rumBundles, start, end) };
  }

  async fetchLastWeek(endDate) {
    const date = endDate ? new Date(endDate) : new Date();
    const hoursInWeek = 7 * 24;
    const promises = [];
    for (let i = 0; i < hoursInWeek; i += 1) {
      promises.push(this.fetchUTCHour(date.toISOString()));
      date.setTime(date.getTime() - (3600 * 1000));
    }
    const chunks = Promise.all(promises);
    return chunks;
  }

  async fetchPrevious31Days(endDate) {
    const date = endDate ? new Date(endDate) : new Date();
    const days = 31;
    const promises = [];
    for (let i = 0; i < days; i += 1) {
      promises.push(this.fetchUTCDay(date.toISOString()));
      date.setDate(date.getDate() - 1);
    }
    const chunks = Promise.all(promises);
    return chunks;
  }

  async fetchPrevious12Months(endDate) {
    const date = endDate ? new Date(endDate) : new Date();
    const months = 13; // 13 to include 2 partial months (first and last)
    const promises = [];
    for (let i = 0; i < months; i += 1) {
      promises.push(this.fetchUTCMonth(date.toISOString()));
      date.setMonth(date.getMonth() - 1);
    }
    const chunks = Promise.all(promises);
    return chunks;
  }

  async fetchDateRange(startDate, endDate = new Date().toISOString()) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hoursInRange = Math.floor((end - start) / (1000 * 60 * 60));
    const daysInRange = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const monthsInRange = Math.floor((end - start) / (1000 * 60 * 60 * 24 * 30));
    let promises = [];
    if (daysInRange < 0) {
      throw new Error('Start date must be before end date');
    } else if (hoursInRange < 200) {
      // fetch each hour
      promises = Array.from({ length: hoursInRange + 1 }, (_, i) => {
        const date = new Date(start);
        date.setHours(date.getHours() + i + 1);
        return date.toISOString();
      }).map((hour) => this.fetchUTCHour(hour));
    } else if (daysInRange < 200) {
      // fetch each day
      promises = Array.from({ length: daysInRange + 1 }, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i + 1);
        return date.toISOString();
      }).map((day) => this.fetchUTCDay(day));
    } else {
      // fetch each month
      promises = Array.from({ length: monthsInRange + 1 }, (_, i) => {
        const date = new Date(start);
        date.setMonth(date.getMonth() + i + 1);
        return date.toISOString();
      }).map((month) => this.fetchUTCMonth(month));
    }
    return Promise.all(promises);
  }

  async fetchPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const originalStart = new Date(start);
    let end = endDate ? new Date(endDate) : new Date();
    if (end > Date.now()) {
      end = new Date();
    }

    const diff = end.getTime() - start.getTime();
    if (diff < 0) {
      throw new Error('Start date must be before end date');
    }

    const promises = [];

    if (diff <= (1000 * 60 * 60 * 24 * 7)) {
      // less than a week
      const hours = Math.round((diff / (1000 * 60 * 60))) + 1;

      for (let i = 0; i < hours; i += 1) {
        promises.push(this.fetchUTCHour(start.toISOString(), originalStart, end));
        if (start.getHours() >= 23) {
          start.setDate(start.getDate() + 1);
          start.setHours(0);
        } else {
          start.setHours(start.getHours() + 1);
        }
      }
    } else if (diff <= (1000 * 60 * 60 * 24 * 31)) {
      // less than a month
      const days = Math.round((diff / (1000 * 60 * 60 * 24))) + 1;

      for (let i = 0; i < days; i += 1) {
        promises.push(this.fetchUTCDay(start.toISOString(), originalStart, end));
        start.setDate(start.getDate() + 1);
      }
    } else {
      const months = Math.round(diff / (1000 * 60 * 60 * 24 * 31)) + 1;

      for (let i = 0; i < months; i += 1) {
        promises.push(this.fetchUTCMonth(start.toISOString(), originalStart, end));
        start.setMonth(start.getMonth() + 1);
      }
    }

    return Promise.all(promises);
  }
}
