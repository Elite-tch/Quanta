/**
 * QuanChain Wallet - Content Script
 * Injects the provider into web pages for dApp integration
 */

// Inject the in-page script
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage/inpage.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Only inject on http/https pages
if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
  injectScript();
}

// Bridge between inpage script and background
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const { type, payload, id } = event.data;

  // Forward QuanChain requests to background
  if (type === 'QUANCHAIN_REQUEST') {
    try {
      const response = await chrome.runtime.sendMessage({
        type: payload.method,
        ...payload.params,
        origin: window.location.origin
      });

      window.postMessage({
        type: 'QUANCHAIN_RESPONSE',
        id,
        payload: response
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'QUANCHAIN_RESPONSE',
        id,
        error: error.message
      }, '*');
    }
  }
});

// Notify page that QuanChain provider is available
window.postMessage({ type: 'QUANCHAIN_PROVIDER_READY' }, '*');
