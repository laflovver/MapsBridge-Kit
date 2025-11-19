(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateUrl') {
      try {
        const { url } = request;
        
        if (window.history && window.history.replaceState) {
          const newUrl = new URL(url);
          const currentUrl = new URL(window.location.href);
          
          if (newUrl.origin === currentUrl.origin) {
            const oldHref = window.location.href;
            
            window.history.replaceState({}, '', url);
            
            if (newUrl.hash !== currentUrl.hash) {
              let hashChangeEvent;
              if (typeof HashChangeEvent !== 'undefined') {
                hashChangeEvent = new HashChangeEvent('hashchange', {
                  oldURL: currentUrl.href,
                  newURL: url
                });
              } else {
                hashChangeEvent = document.createEvent('HashChangeEvent');
                hashChangeEvent.initHashChangeEvent('hashchange', false, false, currentUrl.href, url);
              }
              window.dispatchEvent(hashChangeEvent);
            }
            
            const popStateEvent = new PopStateEvent('popstate', {
              state: {}
            });
            window.dispatchEvent(popStateEvent);
            
            const locationChangeEvent = new CustomEvent('locationchange', {
              detail: { href: url, oldHref: oldHref }
            });
            window.dispatchEvent(locationChangeEvent);
            
            sendResponse({ success: true, method: 'history' });
            return true;
          } else {
            sendResponse({ success: false, reason: 'different_origin', needsReload: true });
            return true;
          }
        } else {
          sendResponse({ success: false, reason: 'no_history_api', needsReload: true });
          return true;
        }
      } catch (error) {
        console.error('Error updating URL:', error);
        sendResponse({ success: false, error: error.message, needsReload: true });
        return true;
      }
    }
  });
})();

