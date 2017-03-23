// global variables: 
// cssbeautify(styleString)
// backgroundApi.getCssString
// backgroundApi.getLastInspectedElement
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

/**
 * Single DataStore instance that handles all data
 */
const DataStore = new (function(){
  this.lastInspectedData = null;
  this.inputHtml = null; // maybe change to a function to allow editable textarea
  this.canPirate = () => this.inputHtml && this.inputHtml.length > 0;
  this.cssPieces = null;
  this.getCssString = () => combineCssPieces(this.cssPieces);
  this.getCssStats = () => this.cssPieces.map(x => ({ source: x.source, usage: x.cssText.length }));
  this._includeParents = false;
  
  function combineCssPieces(cssPieces) {
    const hrString = Array(70).join("-");
    const cssString = cssPieces.map(({ source, cssText }) =>
      `/* ${hrString} */\n/* ${source} */\n/* ${hrString} */\n\n${cssText}`
    ).join("\n\n");

    return cssbeautify(cssString);
  }

  this._updateInputHtml = () => {
    if (this.lastInspectedData === null) {
      return;
    }
    if (this._includeParents) {
      this.inputHtml = this.lastInspectedData.fullHtml;
    } else {
      this.inputHtml = this.lastInspectedData.element;
    }
  }

  this.pullLastInspectedData = function() {
    return contentScripts.getLastInspectedElement().then(result => {
      Log(result);
      this.lastInspectedData = result;
      this._updateInputHtml();
    });
  };

  this.setIncludeParents = function(include) {
    this._includeParents = include;
    this._updateInputHtml();
  };

  this.pullUncssResult = function() {
    return backgroundApi.requestStyleSheetsContent(chrome.devtools.inspectedWindow.tabId)
      .then(styleSheets => {
        Log("STYLESHEETS", styleSheets, styleSheets.map(c => c.cssText.length));
        return backgroundApi.requestUncss(this.inputHtml, styleSheets);
      })
      .then(cssData => {
        if (!cssData || !cssData.cssPieces) {
          throw new Error(cssData);
        }
        Log("done", cssData);
        this.cssPieces = cssData.cssPieces;
      });
  };
})();


/**
 * DevTools Panel View abstraction
 * Manages the UI and all view interactions
 */
function PanelEnvironment(panelWindow) {
  const doc = panelWindow.document;
  const $pirateElement = doc.querySelector("#pirateElement");
  const $inspectedDisplay = doc.querySelector("#inspectedResult");
  const $resultCssDisplay = doc.querySelector("#cssResult");
  const $resultStatsDisplay = doc.querySelector("#statsResult");
  const $resultPreview = doc.querySelector("#previewResult");
  const $includeParentsSwitch = doc.querySelector("#include-parents-switch");

  $pirateElement.disabled = true;
  $pirateElement.addEventListener('click', () => {
    if (DataStore.canPirate()) {
      pirateElement(DataStore.inputHtml);
    }
  });
  $includeParentsSwitch.addEventListener('change', () => {
    DataStore.setIncludeParents($includeParentsSwitch.checked);
    if (DataStore.inputHtml) {
      $inspectedDisplay.textContent = DataStore.inputHtml;
    }
  });

  // update on first panel show
  updateLastInspected();
  // event onElementSelectionChanged
  chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    updateLastInspected();
  });

  /** Called everytime user switches to this panel */
  function onPanelShown(win) {
    if (win !== panelWindow) {
      throw new Error("global window changed for panel environment")
    }
  }

  function updateLastInspected() {
    DataStore.pullLastInspectedData().then(() => {
      $pirateElement.disabled = false;
      $inspectedDisplay.textContent = DataStore.inputHtml;
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
    $resultPreview.srcdoc = "";
    Log("Pirate starts");
    DataStore.pullUncssResult().then(() => {
      const cssString = DataStore.getCssString();
      $resultCssDisplay.textContent = cssString;
      $resultStatsDisplay.textContent = JSON.stringify(DataStore.getCssStats(), null, 2);
      $resultPreview.srcdoc = `<style>${cssString}</style>${DataStore.inputHtml}`;
      $pirateElement.disabled = false;
      lastProcessFinished = true;
    })
    .catch(e => {
      console.error("Error when pirating ", e);
      $resultCssDisplay.textContent = "Error occurred.";
    });
  }

  return {
    onShown: onPanelShown
  };
}

