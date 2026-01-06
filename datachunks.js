import { DataChunks, series, facets } from '@adobe/rum-distiller';

/**
 * Categorize user agent string into device types
 * @param {string} ua - User agent string
 * @returns {string} Device category
 */
function categorizeDeviceType(ua) {
  if (!ua) return 'Unknown';
  const lowerUA = ua.toLowerCase();
  
  // Mobile devices
  if (lowerUA.includes('android')) return 'Mobile: Android';
  if (lowerUA.includes('iphone') || lowerUA.includes('ipad') || lowerUA.includes('ipod')) return 'Mobile: iOS';
  
  // Desktop
  if (lowerUA.includes('windows')) return 'Desktop: Windows';
  if (lowerUA.includes('macintosh') || lowerUA.includes('mac os')) return 'Desktop: macOS';
  if (lowerUA.includes('linux') && !lowerUA.includes('android')) return 'Desktop: Linux';
  if (lowerUA.includes('cros')) return 'Desktop: ChromeOS';
  
  return 'Other';
}

/**
 * Extract device type from bundle's user agent
 */
function deviceType(bundle) {
  const ua = bundle.userAgent || '';
  return [categorizeDeviceType(ua)];
}

/**
 * Extract source from enter checkpoint events (normalized URL)
 */
function enterSource(bundle) {
  const enterEvents = bundle.events.filter(e => e.checkpoint === 'enter' && e.source);
  if (enterEvents.length === 0) return [];
  
  // Normalize sources - extract origin + pathname from URLs
  const sources = enterEvents.map(e => {
    try {
      const url = new URL(e.source);
      return url.origin + url.pathname;
    } catch {
      // If not a valid URL, return as-is (e.g., "direct", "typed", etc.)
      return e.source;
    }
  });
  
  return [...new Set(sources)]; // Return unique sources
}

function errorCount(bundle) {
  return bundle.events.filter(
    (event) => event.checkpoint === 'error' && event.source !== 'focus-loss'
  ).length;
}

function isValidError(event) {
  return event.checkpoint === 'error' && event.source !== 'focus-loss';
}

function errorSource(bundle) {
  return bundle.events
    .filter(isValidError)
    .map(({source}) => source)
    .filter(Boolean); // Remove empty sources
}

function errorTarget(bundle) {
  return bundle.events
    .filter(isValidError)
    .map(({target}) => target)
    .filter(Boolean); // Remove empty targets
}

function hour(bundle) {
  const utcDate = new Date(bundle.timeSlot);
  // Format as ISO string in local timezone (keeping only date and hour)
  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getDate()).padStart(2, '0');
  const hour = String(utcDate.getHours()).padStart(2, '0');
  return [`${year}-${month}-${day}T${hour}:00:00`];
}

function missingresource(bundle) {
  return bundle.events
  .filter(e => e.checkpoint === 'missingresource')
  .map(e => e.source);
}

function errorDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);

  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('errorCount', errorCount, 'every');
  dataChunks.addFacet('errorSource', errorSource, 'every');
  dataChunks.addFacet('errorTarget', errorTarget, 'every');
  dataChunks.addFacet('hour', hour, 'every');
  dataChunks.addFacet('userAgent', facets.userAgent);
  dataChunks.addFacet('missingresource', missingresource, 'every');
  dataChunks.addFacet('deviceType', deviceType, 'every');
  dataChunks.addFacet('source', enterSource, 'every');
  return dataChunks;
}

function isFormLoadEvent(event) {
  return event.checkpoint === 'viewblock' && event.source.match(/form/);
}

function getFormLoadEvent(events) {
  return events.find(isFormLoadEvent);
}

function formBlockLoadTime(threshold) {
  return function time(bundle) {
    const sortedEvents = bundle.events.sort((a, b) => a.timeDelta - b.timeDelta);
    const formLoad = getFormLoadEvent(sortedEvents);
    if (threshold && formLoad?.timeDelta > threshold) {
      return undefined;
    }
    if (formLoad?.timeDelta > 0) {
      return formLoad?.timeDelta / 1000;
    }
    return undefined;
  }
}



function performanceDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('lcp', series.lcp);
  dataChunks.addSeries('formBlockLoadTime', formBlockLoadTime(2 * 60 * 1000));
  dataChunks.addFacet('formBlockLoadTime', (bundle) => {
    const getFormLoadTime = formBlockLoadTime()(bundle);
    if (getFormLoadTime) {
      return [`${getFormLoadTime}s`];
    }
    return undefined;
  });
  dataChunks.addSeries('formLoaded', b => b.events.find(isFormLoadEvent) ? b.weight : 0);
  dataChunks.addFacet('hour', hour, 'every', 'none');
  dataChunks.addFacet('userAgent', facets.userAgent);
  dataChunks.addFacet('deviceType', deviceType, 'every');
  dataChunks.addFacet('source', enterSource, 'every');
  return dataChunks;
}

function engagementDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addFacet('hour', hour, 'every', 'none');
  dataChunks.addSeries('fills', b => b.events.find(e => e.checkpoint === 'fill') ? b.weight : 0);
  dataChunks.addSeries('clicks', b => b.events.find(e => e.checkpoint === 'click') ? b.weight : 0);
  dataChunks.addSeries('fillCount', b => b.events.filter(e => e.checkpoint === 'fill').length);
  dataChunks.addSeries('clickCount', b => b.events.filter(e => e.checkpoint === 'click').length);
  return dataChunks;
}

function resourceDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addFacet('hour', hour, 'every', 'none');
  dataChunks.addFacet('missingresource', missingresource, 'every');
  return dataChunks;
}

export { errorDataChunks, performanceDataChunks, engagementDataChunks, resourceDataChunks };