# Bundler API

Returns bundles with the following format
```
  [
    {
      date: '2025-10-06',
      hour: '00',
      rumBundles: [{
        url: ...,
        host: ...,
        id: ... // unique id for the bundle,
        time: ... // time of the bundle without the minute information
        timeSlot: '2025-10-06T00:00:00Z', // time information without minutes and seconds
        weight: ... // weight of the bundle as the data is sampled
        userAgent: ... // user agent of the bundle as specified in the documentation
        events: [
          {
            checkpoint: As specified in the documentation
            source: As specified in the documentation
            target: As specified in the documentation
            timeDelta: The time in milliseconds for this event to occur
                      from page load
          },
          {...}
          ...
        ]}
    }, {...}, {...},
  ]
```
# Reference Documentation:
https://www.aem.live/developer/operational-telemetry
https://www.aem.live/docs/operational-telemetry

