// global variables: 
// contentScripts.getStyleSheets
// contentScripts.getLastInspectedElement
const panelFilepath = "src/panel.html";
const iconFilepath = "images/icon128.png";

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
  const $ = panelWindow.jQuery;
  const $pirateElement = $("#pirateElement");
  const $inspectedDisplay = $("#inspectedResult");
  const $resultCssDisplay = $("#cssResult");
  let lastInspectedElementHtml = null;

  $pirateElement.prop('disabled', true);
  $pirateElement.click(() => {
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
      console.log(result);
      if (lastInspectedElementHtml == null) {
        // first time it can be used
        $pirateElement.prop('disabled', false);
      }
      lastInspectedElementHtml = result.element;
      $inspectedDisplay.html(result.element);
    }).catch(e => {
      $inspectedDisplay.text("Nothing inspected recently.");
    });
  }

  let lastProcessFinished = true;
  function pirateElement(inputHtml) {
    if (!lastProcessFinished) {
      console.log("Not yet finished");
      return;
    }
    lastProcessFinished = false;
    $pirateElement.prop('disabled', true);
    $resultCssDisplay.text("");
    backgroundApi.requestStyleSheetsContent(chrome.devtools.inspectedWindow.tabId)
    .then(styleSheets => {
      console.log("STYLESHEETS", styleSheets);
      return backgroundApi.requestUncss(inputHtml, styleSheets);
    })
    .then(simplifiedCss => {
      console.log("done", simplifiedCss);
      $resultCssDisplay.text(JSON.stringify(simplifiedCss.stats, null, 2) +'\n\n' + simplifiedCss.css);
      $pirateElement.prop('disabled', false);
      lastProcessFinished = true;
    })
    .catch(e => {
      console.error("Error when pirating ", e);
      $resultCssDisplay.text("Error occurred.");
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

  function requestStyleSheetsContent(tabId) {
    if (lastCachedStyleSheetsResponse !== null && tabId === lastCachedStyleSheetsTabId) {
      return Promise.resolve(lastCachedStyleSheetsResponse);
    }
    // First pull hrefs from content DOM and then 'fetch' in background.js
    return contentScripts.getStyleSheets().then(styleSheets => {
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

