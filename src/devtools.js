// global variables: 
// backgroundApi.getCssString
// backgroundApi.getLastInspectedElement
// contentScripts.getStyleSheets
// contentScripts.getLastInspectedElement
// html_beautify, css_beautify
// jQuery, $
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

const Utils = {
  combineCssPieces(cssPieces) {
    const hrString = Array(70).join("-");
    const cssString = cssPieces.map(({ source, cssText }) =>
      `/* ${hrString}\n * ${source} \n * ${hrString} \n */\n\n${cssText}`
    ).join("\n\n");

    return css_beautify(cssString);
  },

  replaceRelativePaths(htmlString, baseUrl) {
    const $html = jQuery(`<div>${htmlString}</div>`);
    $html.find('img').each((ind, el) => {
      const original = el.outerHTML;
      el.src = new URL($(el.outerHTML).attr('src'), baseUrl).href;
      htmlString = htmlString.replace(original, el.outerHTML);
    });
    return htmlString;
  },

  normalizeRawHtml(rawHtmlString, baseUrl) {
    Log("Raw html length: ", rawHtmlString.length);
    const options = {
      indent_size: 2,
      wrap_line_length: 0, // disable (max char per line)
      preserve_newlines: false
    };
    const beautified = html_beautify(rawHtmlString, options);
    if (!baseUrl || typeof baseUrl != "string") {
      return beautified;
    }
    return Utils.replaceRelativePaths(beautified, baseUrl);
  }
};

/**
 * Single DataStore instance that handles all data
 */
const DataStore = new (function(){
  this.lastInspectedData = null;
  this.inputHtml = null; // maybe change to a function to allow editable textarea
  this.canPirate = () => this.inputHtml && this.inputHtml.length > 0;
  this.cssPieces = null;
  this.originalSheetLengths = {}; // { sourceA.css => 54321 chars }
  this.getCssString = () => Utils.combineCssPieces(this.cssPieces.filter(p => p.selected));
  this._includeParents = false;

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
      this.lastInspectedData = result;
      this.lastInspectedData.element = Utils.normalizeRawHtml(result.element, result.href);
      this.lastInspectedData.fullHtml = Utils.normalizeRawHtml(result.fullHtml, result.href);
      Log(result.href, result, this.lastInspectedData);
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
        this.originalSheetLengths = {};
        styleSheets.forEach(sheet => {
          if (sheet.source) {
            this.originalSheetLengths[sheet.source] = sheet.cssText.length;
          }
        });
        return backgroundApi.requestUncss(this.inputHtml, styleSheets);
      })
      .then(cssData => {
        if (!cssData || !cssData.cssPieces) {
          throw new Error(cssData);
        }
        Log("done", cssData);
        this.cssPieces = cssData.cssPieces;
        this.cssPieces.forEach(piece => piece.selected = true);
      });
  };
})();


/**
 * DevTools Panel View abstraction
 * Manages the UI and all view interactions
 */
function PanelEnvironment(panelWindow) {
  const doc = panelWindow.document;
  const Prism = panelWindow.Prism; // syntax color highlighting
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
      setInspectedDisplayContent(DataStore.inputHtml);
    }
  });

  // update on first panel show
  updateLastInspected();
  let updateQueued = false;
  // event onElementSelectionChanged
  chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    updateQueued = true;
  });

  /** Called everytime user switches to this panel */
  function onPanelShown(win) {
    if (win !== panelWindow) {
      throw new Error("global window changed for panel environment")
    }
    if (updateQueued) {
      updateQueued = false;
      updateLastInspected();
    }
  }

  function setInspectedDisplayContent(htmlString) {
    $inspectedDisplay.innerHTML = Prism.highlight(htmlString, Prism.languages.html);
    //$inspectedDisplay.textContent = htmlString;
  }

  function updateLastInspected() {
    $inspectedDisplay.textContent = "";
    DataStore.pullLastInspectedData().then(() => {
      $pirateElement.disabled = false;
      setInspectedDisplayContent(DataStore.inputHtml);
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
      createCssSelection(DataStore.cssPieces);
      updateResultPreview();
      $pirateElement.disabled = false;
      lastProcessFinished = true;
    })
    .catch(e => {
      console.error("Error when pirating ", e);
      $resultCssDisplay.textContent = "Error occurred.";
    });
  }

  function updateResultPreview() {
    const cssString = DataStore.getCssString();
    $resultCssDisplay.innerHTML = Prism.highlight(cssString, Prism.languages.css);
    $resultPreview.srcdoc = `<style>${cssString}</style>${DataStore.inputHtml}`;
  }

  function createCssSelection(cssPieces) {
    const boxList = document.createElement("div");
    cssPieces.forEach(piece => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.addEventListener("change", () => {
        piece.selected = input.checked;
        updateResultPreview();
      });

      const descr = document.createElement("span");
      let percUsed = DataStore.originalSheetLengths[piece.source];
      percUsed = percUsed ? ` ~ ${Math.min(100, 100 * piece.cssText.length / percUsed).toFixed()}%` : "";
      descr.innerHTML = `<span class="source-item-title"><strong>${piece.filename}</strong> ` +
        `(${piece.cssText.length} chars used${percUsed})</span><br><span>${piece.source}</span>`;
      const wrapperDiv = document.createElement("div");
      wrapperDiv.className = "source-item";
      wrapperDiv.appendChild(input);
      wrapperDiv.appendChild(descr);

      boxList.appendChild(wrapperDiv);
    });
    $resultStatsDisplay.innerHTML = "";
    $resultStatsDisplay.appendChild(boxList);
  }

  return {
    onShown: onPanelShown
  };
}

