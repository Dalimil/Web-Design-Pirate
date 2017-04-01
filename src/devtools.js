// global variables: 
// backgroundApi.getCssString
// backgroundApi.getLastInspectedElement
// contentScripts.getStyleSheets
// contentScripts.getLastInspectedElement
// html_beautify, css_beautify
// cssParser
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
    const $html = Utils.transformHtmlToJQuery(htmlString);
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
  },

  randomString(len) {
    // max len ~ 20
    return (Math.random() + 1).toString(36).substr(2, len);
  },

  addCssModuleScopeClass(cssString) {
    try {
      const classModulePrefix = `__${Utils.randomString(6)}`;
      const cssAst = cssParser.parse(cssString, { silent: false });
      cssAst.stylesheet.rules.forEach(rule => {
        if (rule.selectors) {
          rule.selectors = rule.selectors.map(s => `${classModulePrefix} ${s}`);
        }
      });
      Log(cssAst);
      return cssParser.stringify(cssAst);
    } catch(e) {
      // Parse error, return original string
      return cssString;
    }
  },

  replaceCssRelativeUrls(cssString, baseUrl) {
    try {
      const cssAst = cssParser.parse(cssString, { silent: false });
      cssAst.stylesheet.rules.forEach(rule => {
        if (rule.declarations) {
          rule.declarations.forEach(declaration => {
            const match = declaration.value && declaration.value.match(/url\("?([^")]+)"?\)/);
            if (match && match[1]) {
              const fullHref = new URL(match[1], baseUrl).href;
              declaration.value = declaration.value.replace(match[0], `url(${fullHref})`);
              // Log("New CSS url replacement:", declaration.value);
            }
          });
        }
      });
      return cssParser.stringify(cssAst);
    } catch(e) {
      // Parse error, return original string
      return cssString;
    }
  },

  fakeBodyTag: "bodytag",
  transformHtmlToJQuery(htmlString) {
    if (htmlString.startsWith("<body")) {
      htmlString = htmlString.replace("<body", `<${Utils.fakeBodyTag}`)
        .replace("</body", `</${Utils.fakeBodyTag}`);
    }
    return jQuery(htmlString);
  },
  transformJQueryToHtml($html) {
    let htmlString = $html.get(0).outerHTML;
    if (htmlString.startsWith(`<${Utils.fakeBodyTag}`)) {
      htmlString = htmlString.replace(`<${Utils.fakeBodyTag}`, "<body")
        .replace(`</${Utils.fakeBodyTag}`, "</body");
    }
    return htmlString;
  },

  getHtmlTreeDepth(htmlString) {
    let $html = Utils.transformHtmlToJQuery(htmlString);
    let depth = 0;
    while ($html.length > 0) {
      depth += 1;
      $html = $html.children().first();
    }
    return depth;
  },

  /**
   * If we imagine the html to be a tree with certain depth H,
   * then f(s, 0, H) returns original s,
   * then f(s, 0, H-1) returns original with node leaves removed
   * then f(s, 1, H) returns .innerHTML() with only the first html child
   */
  getHtmlBetweenTreeLevels(htmlString, levelStart, levelEnd) {
    let $html = Utils.transformHtmlToJQuery(htmlString);
    for (let i = 0; i < levelStart; i++) {
      $html = $html.children().first(); // safe even for an empty selection
    }
    const removeDeeperThan = ($el, maxDepth) => {
      if (maxDepth <= 0) {
        return $el.empty();
      }
      removeDeeperThan.children.each((ind, el) => {
        removeDeeperThan(jQuery(el), maxDepth-1);
      });
    };
    removeDeeperThan($html, levelEnd - levelStart);
    
    return Utils.transformJQueryToHtml($html);
  }
};


/**
 * Single DataStore instance that handles all data
 */
const DataStore = new (function(){
  this.lastInspectedData = null; // { element, fullHtml, href }
  this.inputHtml = null; // maybe change to a function to allow editable textarea
  this.canPirate = () => this.inputHtml && this.inputHtml.length > 0;
  this.cssPieces = null;
  this.originalSheetLengths = {}; // { sourceA.css => 54321 chars }
  this._includeParents = false;
  this._scopeCssModule = false;

  this.getCssString = function(disallowScoped) {
    if (this.cssPieces === null) {
      return "";
    }
    const basicCssString = Utils.combineCssPieces(this.cssPieces.filter(p => p.selected));
    if (this._scopeCssModule && !disallowScoped) {
      return Utils.addCssModuleScopeClass(basicCssString);
    }
    return basicCssString;
  };

  this._updateInputHtml = function() {
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

  this.setScopeCssModule = function(setScope) {
    this._scopeCssModule = setScope;
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
        this.cssPieces.forEach(piece => {
          piece.selected = true;
          const sheetUrl = piece.source == "internal" ? this.lastInspectedData.href : piece.source;
          piece.cssText = Utils.replaceCssRelativeUrls(piece.cssText, sheetUrl);
        });
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
  const $scopeCssSwitch = doc.querySelector("#scope-css-switch");
  const $openResultWindow = doc.querySelector("#open-window-result");

  $pirateElement.disabled = true;
  $pirateElement.addEventListener('click', () => {
    if (DataStore.canPirate()) {
      pirateElement();
    }
  });
  $includeParentsSwitch.addEventListener('change', () => {
    DataStore.setIncludeParents($includeParentsSwitch.checked);
    if (DataStore.inputHtml) {
      updateInspectedDisplayContent();
    }
  });
  $scopeCssSwitch.addEventListener('change', () => {
    DataStore.setScopeCssModule($scopeCssSwitch.checked);
    if (DataStore.cssPieces) {
      updateResultPreview();
    }
  });
  $openResultWindow.disabled = true;
  $openResultWindow.addEventListener('click', () => {
    backgroundApi.requestResultWindow(getResultSrcDoc());
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

  function updateInspectedDisplayContent() {
    $inspectedDisplay.innerHTML = Prism.highlight(DataStore.inputHtml, Prism.languages.html);
  }

  function updateLastInspected() {
    $inspectedDisplay.textContent = "";
    DataStore.pullLastInspectedData().then(() => {
      $pirateElement.disabled = false;
      updateInspectedDisplayContent();
    }).catch(e => {
      $inspectedDisplay.textContent = "Nothing inspected recently.";
    });
  }

  let lastProcessFinished = true;
  function pirateElement() {
    if (!lastProcessFinished) {
      Log("Not yet finished");
      return;
    }
    lastProcessFinished = false;
    $pirateElement.disabled = true;
    $openResultWindow.disabled = true;
    $resultCssDisplay.textContent = "";
    $resultStatsDisplay.textContent = "";
    $resultPreview.srcdoc = "";
    Log("Pirate starts");
    DataStore.pullUncssResult().then(() => {
      createCssSelection(DataStore.cssPieces);
      updateResultPreview();
      $pirateElement.disabled = false;
      $openResultWindow.disabled = false;
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
    $resultPreview.srcdoc = getResultSrcDoc();
  }

  function getResultSrcDoc() {
    return `<style>${DataStore.getCssString(true)}</style>${DataStore.inputHtml}`;
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

