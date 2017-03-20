// global variables: 
// cssbeautify(styleString)
// contentScripts.getStyleSheets
// contentScripts.getLastInspectedElement
const panelFilepath = "src/panel.html";
const iconFilepath = "images/icon128.png";

const Log = (...args) => console.log.apply(console, args);

// Create a new Devtools Panel
chrome.devtools.panels.create("Pirate", iconFilepath, panelFilepath, (thisPanel) => {
  // Panel created
  let panel = null;

  thisPanel.onShown.addListener(panelWindow => {
    // User switched to this panel
    if (panel == null) {
      panel = PanelEnvironment(panelWindow);
    }
    panel.onShown(panelWindow);
  });

});

function PanelEnvironment(panelWindow) {
  const doc = panelWindow.document;
  const $pirateElement = doc.querySelector("#pirateElement");
  const $inspectedDisplay = doc.querySelector("#inspectedResult");
  const $resultCssDisplay = doc.querySelector("#cssResult");
  const $resultStatsDisplay = doc.querySelector("#statsResult");
  const $resultPreview = doc.querySelector("#previewResult");
  let lastInspectedElementHtml = null;

  $pirateElement.disabled = true;
  $pirateElement.addEventListener('click', () => {
    if (lastInspectedElementHtml && typeof lastInspectedElementHtml === "string") {
      pirateElement(lastInspectedElementHtml);
    }
  });
  // update on first panel show
  showLastInspected();
  // event onElementSelectionChanged
  chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    showLastInspected();
  });

  /** Called everytime user switches to this panel */
  function onPanelShown(win) {
    if (win !== panelWindow) {
      throw new Error("global window changed for panel environment")
    }
  }

  function showLastInspected() {
    contentScripts.getLastInspectedElement().then(result => {
      Log(result);
      if (lastInspectedElementHtml == null) {
        // first time it can be used
        $pirateElement.disabled = false;
      }
      lastInspectedElementHtml = result.element;
      $inspectedDisplay.textContent = result.element;
    }).catch(e => {
      $inspectedDisplay.textContent = "Nothing inspected recently.";
    });
  }

  let lastProcessFinished = true;
  function pirateElement(inputHtml) {
    if (!lastProcessFinished) {
      Log("Not yet finished");
      return;
    }
    lastProcessFinished = false;
    $pirateElement.disabled = true;
    $resultCssDisplay.textContent = "";
    $resultStatsDisplay.textContent = "";
    Log("Pirate starts");
    backgroundApi.requestStyleSheetsContent(chrome.devtools.inspectedWindow.tabId)
    .then(styleSheets => {
      Log("STYLESHEETS", styleSheets, styleSheets.map(c => c.cssText.length));
      return backgroundApi.requestUncss(inputHtml, styleSheets);
    })
    .then(cssData => {
      if (!cssData.css || !cssData.stats) {
        throw new Error(cssData);
      }
      Log("done", cssData);
      return {
        css: cssbeautify(cssData.css),
        stats: cssData.stats 
      };
    }).then(cssData => {
      $resultCssDisplay.textContent = cssData.css;
      $resultStatsDisplay.textContent = JSON.stringify(cssData.stats, null, 2);
      $resultPreview.srcdoc = `<style>${cssData.css}</style>${inputHtml}`;
      $pirateElement.disabled = false;
      lastProcessFinished = true;
    })
    .catch(e => {
      console.error("Error when pirating ", e);
      $resultCssDisplay.textContent = "Error occurred.";
      $resultStatsDisplay.textContent = "";
    });
  }

  return {
    onShown: onPanelShown
  };
}

/**
 * Wrapper for communication with the background.js page
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

