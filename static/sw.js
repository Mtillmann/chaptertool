// Licensed under a CC0 1.0 Universal (CC0 1.0) Public Domain Dedication
// http://creativecommons.org/publicdomain/zero/1.0/

// HTML files: try the network first, then the cache.
// Other files: try the cache first, then the network.
// Both: cache a fresh version if possible.
// (beware: the cache will grow and grow; there's no cleanup)

const cacheName = 'files';

addEventListener('fetch',  fetchEvent => {

  return; //return always?! will this work

  const request = fetchEvent.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    return;
  }

  fetchEvent.respondWith(async function() {
    const fetchPromise = fetch(request);
    fetchEvent.waitUntil(async function() {
      const responseFromFetch = await fetchPromise;
      const responseCopy = responseFromFetch.clone();
      const myCache = await caches.open(cacheName);
      return myCache.put(request, responseCopy);
    }());
    if (request.headers.get('Accept').includes('text/html')) {
      try {
        return await fetchPromise;
      }
      catch(error) {
        return caches.match(request);
      }
    } else {
      const responseFromCache = await caches.match(request);
      return responseFromCache || fetchPromise;
    }
  }());
});