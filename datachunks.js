import { DataChunks, series, facets } from '@adobe/rum-distiller';


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

function errorDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);

  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('errorCount', errorCount, 'every', 'none');
  dataChunks.addFacet('errorSource', errorSource, 'every', 'none');
  dataChunks.addFacet('errorTarget', errorTarget, 'every', 'none');
  dataChunks.addFacet('hour', hour, 'every', 'none');
  dataChunks.addFacet('userAgent', facets.userAgent);
  return dataChunks;
}

function isFormLoadEvent(event) {
  return event.checkpoint === 'viewblock' && event.source.match(/form/);
}

function getFormLoadEvent(events) {
  return events.find(isFormLoadEvent);
}

function formBlockLoadTime(bundle) {
  const sortedEvents = bundle.events.sort((a, b) => a.timeDelta - b.timeDelta);
  const formLoad = getFormLoadEvent(sortedEvents);
  if (formLoad?.timeDelta > 2 * 60 * 1000) {
    return undefined;
  }
  if (formLoad?.timeDelta > 0) {
    return formLoad?.timeDelta / 1000;
  }
  return undefined;
}

function loadDataChunks(data) {
  const dataChunks = new DataChunks();
  dataChunks.load(data);
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('formBlockLoadTime', formBlockLoadTime);
  dataChunks.addSeries('formLoaded', b => b.events.find(isFormLoadEvent) ? b.weight : 0);
  dataChunks.addFacet('hour', hour, 'every', 'none');
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

export { errorDataChunks, loadDataChunks, engagementDataChunks };