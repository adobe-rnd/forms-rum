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
    const domainKey = urlParams.get('domainKey');
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
      return 'open';
    }
    return domainkey;
  } catch (e) {
    return 'error';
  }
}

export default class DataLoader {
  constructor() {
    this.API_ENDPOINT = 'https://bundles.aem.page';
    this.DOMAIN = 'www.thinktanked.org';
    this.DOMAIN_KEY = undefined;
    this.granularity = 'month';
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

    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    const json = await resp.json();
    const { rumBundles } = json;
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

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

    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    const json = await resp.json();
    const { rumBundles } = json;
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

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
    // Fetch from API if not cached
    const resp = await fetch(apiRequestURL);
    const json = await resp.json();
    const { rumBundles } = json;
    rumBundles.forEach((bundle) => addCalculatedProps(bundle));

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
