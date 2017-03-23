// depends on: contentScripts.js
/**
 * Wrapper for communication with the background.js page
 * It is used by the client and abstracts away caching
 */
const backgroundApi = (() => {
  let lastCachedStyleSheetsTabId = null;
  let lastCachedStyleSheetsResponse = null;
  chrome.devtools.network.onNavigated.addListener(resetCache);

  function resetCache() {
    lastCachedStyleSheetsTabId = null;
    lastCachedStyleSheetsResponse = null;
  }

  function requestStyleSheetsContent(tabId) {
    if (lastCachedStyleSheetsResponse !== null && tabId === lastCachedStyleSheetsTabId) {
      return Promise.resolve(lastCachedStyleSheetsResponse);
    }
    // First pull hrefs from content DOM and then 'fetch' in background.js
    return contentScripts.getStyleSheets().then(styleSheets => {
      Log("Raw stylesheets", styleSheets);
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          requestType: "stylesheets",
          styleSheets
        }, function(response) {
          lastCachedStyleSheetsTabId = tabId;
          lastCachedStyleSheetsResponse = response;
          resolve(response);
        });
      });
    });
  }

  function requestUncss(inputHtml, styleSheets) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        requestType: "uncss",
        inputHtml,
        styleSheets
      }, function(response) {
        resolve(response);
      });
    });
  }

  return {
    requestStyleSheetsContent,
    requestUncss
  };
})();

