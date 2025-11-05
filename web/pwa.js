'use strict';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(reg => {
        document.title = 'BWS Vittoria - ' + document.location.hostname;
        // console.log('BWS Vittoria service worker registered.', reg);
        return true;
      })
      .catch(err =>
        console.warn('Error registering BWS Vittoria service worker ' + err)
      );
  });
}
