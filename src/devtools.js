// global variables: 
// backgroundApi.getCssString
// backgroundApi.getLastInspectedElement
// contentScripts.getStyleSheets
// contentScripts.getLastInspectedElement
// Log, Utils.*
// jQuery, $
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

/**
 * Single DataStore instance that handles all data
 */
const DataStore = new (function(){
  this.lastInspectedData = null; // { element, fullHtml, href, elementTreeDepth, fullTreeDepth }
  this.inputHtml = null; // maybe change to a function to allow editable textarea
  this.pageStyleSheets = null; // [ { source, cssText, isInternal, filename }, ...]
  this._styleSheetMap = {} // { example.com/a.css => (ref)pageStyleSheets, ... }
  this.getStyleSheet = (source) => this._styleSheetMap[source]; // quick dictionary access by source
  this.canPirate = () => this.inputHtml && this.inputHtml.length > 0 && this.pageStyleSheets;
  this.cssPieces = null;
  this.getSelectedCssPieces = () => this.cssPieces.filter(p => this.getStyleSheet(p.source).selected);
  this._scopeCssModule = false;
  this._minifyCssOption = false;
  this.previewInExternalWindow = false;

  this.getCssString = function(disallowScoped) {
    if (this.cssPieces === null) {
      return "";
    }
    const basicCssString = Utils.combineCssPieces(
      this.getSelectedCssPieces(),
      this._minifyCssOption
    );
    if (this._scopeCssModule && !disallowScoped) {
      return Utils.addCssModuleScopeClass(basicCssString, this._minifyCssOption);
    }
    return basicCssString;
  };

  this.setHtmlTreeRange = function(levelStart, levelEnd) {
    if (this.lastInspectedData === null) {
      return;
    }
    if (levelStart == 0 && levelEnd == this.lastInspectedData.fullTreeDepth) {
      this.inputHtml = this.lastInspectedData.fullHtml;
    }
    this.inputHtml = Utils.getHtmlBetweenTreeLevels(this.lastInspectedData.fullHtml, levelStart, levelEnd);
  }

  this.pullLastInspectedData = function() {
    return contentScripts.getLastInspectedElement().then(result => {
      this.lastInspectedData = result;
      this.lastInspectedData.element = Utils.normalizeRawHtml(result.element, result.href);
      this.lastInspectedData.fullHtml = Utils.normalizeRawHtml(result.fullHtml, result.href);
      this.lastInspectedData.elementTreeDepth = Utils.getHtmlTreeDepth(result.element);
      this.lastInspectedData.fullTreeDepth = Utils.getHtmlTreeDepth(result.fullHtml);
      this.inputHtml = this.lastInspectedData.fullHtml;
      Log(result.href, result, this.lastInspectedData);
    });
  };

  this.setScopeCssModule = function(setScope) {
    this._scopeCssModule = setScope;
  };
  this.setMinifyCssOption = function(setMinify) {
    this._minifyCssOption = setMinify;
  };
  this.setPreviewInExternalWindow = function(setPreviewExternal) {
    this.previewInExternalWindow = setPreviewExternal;
  };

  this.getResultSrcDoc = function() {
    const injectedScriptFilename = "/src/result-popup/iframeInjected.js";
    return `<style>${this.getCssString(true)}</style>${this.inputHtml}
      <script src="${injectedScriptFilename}"></script>`;
  };

  this.pullStylesheets = function() {
    return backgroundApi.requestStyleSheetsContent(chrome.devtools.inspectedWindow.tabId)
      .then(({ styleSheets, hasChanged }) => {
        if (hasChanged) {
          Log("STYLESHEETS", styleSheets, styleSheets.map(c => c.cssText.length));
          this.pageStyleSheets = styleSheets;
          this._styleSheetMap = {};
          styleSheets.forEach(sheet => {
            sheet.selected = true;
            this._styleSheetMap[sheet.source] = sheet;
          });
        }
        return hasChanged;
      });
  };

  this.pullUncssResult = function() {
    return backgroundApi.requestUncss(this.inputHtml, this.pageStyleSheets)
      .then(cssData => {
        if (!cssData || !cssData.cssPieces) {
          throw new Error(cssData);
        }
        Log("done", cssData);
        this.cssPieces = cssData.cssPieces;
        this.cssPieces.forEach(piece => {
          const sheetUrl = piece.isInternal ? this.lastInspectedData.href : piece.source;
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
  const NoUiSlider = panelWindow.noUiSlider;
  const $inspectedDisplay = doc.querySelector("#inspectedResult");
  const $treeRangeSlider = doc.querySelector("#tree-range-slider");
  const $styleSheetsInputDisplay = doc.querySelector("#styleSheetsInput");
  const $resultCssDisplay = doc.querySelector("#cssResult");
  const $resultStatsDisplay = doc.querySelector("#statsResult");
  const $resultPreview = doc.querySelector("#previewResult");
  const $scopeCssSwitch = doc.querySelector("#scope-css-switch");
  const $minifyCssSwitch = doc.querySelector("#minify-css-switch");
  const $openResultWindow = doc.querySelector("#new-window-result");
  const $loadingIndicatorLeft = doc.querySelector("#loading-indicator-left");
  const $loadingIndicatorRight = doc.querySelector("#loading-indicator-right");
  
  initTabLayouts(panelWindow.jQuery);

  $scopeCssSwitch.addEventListener('change', () => {
    DataStore.setScopeCssModule($scopeCssSwitch.checked);
    updateResultPreview();
  });
  $minifyCssSwitch.addEventListener('change', () => {
    DataStore.setMinifyCssOption($minifyCssSwitch.checked);
    updateResultPreview();
  });
  $openResultWindow.addEventListener('change', () => {
    DataStore.setPreviewInExternalWindow($openResultWindow.checked);
    updateExternalPreview();
  });

  // update on first panel show
  updateLastInspected();
  updateInputStylesheets();
  let updateQueued = {
    inputHtml: false,
    inputStylesheets: false
  };
  // event onElementSelectionChanged
  chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    updateQueued.inputHtml = true;
  });
  chrome.devtools.network.onNavigated.addListener(() => {
    updateQueued.inputHtml = true;
    updateQueued.inputStylesheets = true;
  });

  /** Called everytime user switches to this panel */
  function onPanelShown(win) {
    if (win !== panelWindow) {
      throw new Error("global window changed for panel environment")
    }
    if (updateQueued.inputHtml) {
      updateQueued.inputHtml = false;
      updateLastInspected();
    }
    if (updateQueued.inputStylesheets) {
      updateQueued.inputStylesheets = false;
      updateInputStylesheets();
    }
  }

  function onInputHtmlChanged() {
    // Update html display
    $inspectedDisplay.innerHTML = Prism.highlight(DataStore.inputHtml, Prism.languages.html);
    tryPirate();
  }

  function updateLastInspected() {
    $inspectedDisplay.textContent = "";
    $loadingIndicatorLeft.style.visibility = "visible";
    DataStore.pullLastInspectedData().then(() => {
      initTreeRangeSlider();
      onInputHtmlChanged();
    }).catch(e => {
      $inspectedDisplay.textContent = e.value;
    }).then(() => {
      $loadingIndicatorLeft.style.visibility = "hidden";
    });
  }

  function updateInputStylesheets() {
    $styleSheetsInputDisplay.textContent = "";
    DataStore.pullStylesheets().then(hasChanged => {
      if (hasChanged) {
        initCssSelection();
        tryPirate();
      }
    }).catch(e => {
      Log(e);
      $styleSheetsInputDisplay.textContent = JSON.stringify(e);
    });
  }

  let lastProcessFinished = true;
  let scheduledPirateTimeout = null;
  function tryPirate() {
    if (DataStore.canPirate()) {
      if (!lastProcessFinished) {
        Log("Not yet finished");
        // try later; overwrite prev. scheduled timeouts to slow down
        clearTimeout(scheduledPirateTimeout);
        scheduledPirateTimeout = setTimeout(tryPirate, 1000);
        return;
      }
      lastProcessFinished = false;
      _pirateElement();
    }
  }

  function _pirateElement() {
    Log("Pirate starts");
    $loadingIndicatorRight.style.visibility = "visible";
    DataStore.pullUncssResult().then(() => {
      updateResultPreview();
    }).catch(e => {
      $resultCssDisplay.textContent = "An error occurred. " + e;
    }).then(() => {
      lastProcessFinished = true;
      $loadingIndicatorRight.style.visibility = "hidden";
    });
  }

  function updateResultPreview() {
    if (DataStore.cssPieces) {
      initCssStats();
      const cssString = DataStore.getCssString();
      $resultCssDisplay.innerHTML = Prism.highlight(cssString, Prism.languages.css);
      $resultPreview.srcdoc = DataStore.getResultSrcDoc();
      updateExternalPreview();
    }
  }

  function updateExternalPreview() {
    if (DataStore.previewInExternalWindow && DataStore.cssPieces) {
      backgroundApi.requestResultWindow(DataStore.getResultSrcDoc());
    }
  }

  function initCssStats() {
    const boxList = document.createElement("div");
    DataStore.getSelectedCssPieces().forEach(piece => {
      const descr = document.createElement("span");
      let percUsed = DataStore.getStyleSheet(piece.source).cssText.length;
      percUsed = Math.min(100, 100 * piece.cssText.length / percUsed).toFixed();
      descr.innerHTML = `<span class="source-item-title"><strong>${piece.filename}</strong> ` +
        `(${piece.cssText.length.toLocaleString()} chars used)</span><br>` +
        `<div class="progress"><div class="progress-bar" style="width: ${percUsed}%;">${percUsed}%</div></div>`;
      
      const wrapperDiv = document.createElement("div");
      wrapperDiv.className = "source-item";
      wrapperDiv.appendChild(descr);
      boxList.appendChild(wrapperDiv);
    });
    $resultStatsDisplay.innerHTML = "";
    $resultStatsDisplay.appendChild(boxList);
  }

  function initCssSelection() {
    const boxList = document.createElement("div");
    DataStore.pageStyleSheets.forEach(sheet => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.addEventListener("change", () => {
        sheet.selected = input.checked;
        updateResultPreview();
      });
      const descr = document.createElement("span");
      const sourceDescr = sheet.isInternal ? "&lt;style&gt; inside the &lt;head&gt; tag" : sheet.source;
      descr.innerHTML = `<span class="source-item-title"><strong>${sheet.filename}</strong> ` +
        `(${sheet.cssText.length.toLocaleString()} chars)</span><br><span>${sourceDescr}</span>`;
      const wrapperDiv = document.createElement("div");
      wrapperDiv.className = "source-item";
      wrapperDiv.appendChild(input);
      wrapperDiv.appendChild(descr);

      boxList.appendChild(wrapperDiv);
    });
    $styleSheetsInputDisplay.innerHTML = "";
    $styleSheetsInputDisplay.appendChild(boxList);
  }

  function initTreeRangeSlider() {
    const maxDepth = DataStore.lastInspectedData.fullTreeDepth;
    const targetDepth = maxDepth - DataStore.lastInspectedData.elementTreeDepth;
    if ($treeRangeSlider.noUiSlider) {
      $treeRangeSlider.noUiSlider.destroy();
    }
    NoUiSlider.create($treeRangeSlider, {
      start: [targetDepth, maxDepth],
      connect: true,
      step: 1,
      range: { min: 0, max: maxDepth },
      pips: {
        mode: 'steps',
        density: 100/maxDepth
      }
    });
    $treeRangeSlider.noUiSlider.on('update', (values, handle) => {
      const from = Math.round(values[0]);
      const to = Math.round(values[1]);
      if (from == maxDepth) { 
        return; // no nodes - prevent this
      }
      DataStore.setHtmlTreeRange(from, to);
      onInputHtmlChanged();
    });
  }

  function initTabLayouts(panelJQuery) {
    const tabWidth = 120;
    panelJQuery(".tabs-header > li").click(e => {
      const $el = panelJQuery(e.target);
      const $tabsBlock = $el.parents(".tabs-layout").first();

      if ($el.hasClass('slider')) {
        return; // prevent slider click
      }
      $el.parent().find(".slider").css({
        left: (tabWidth * $el.index()) + "px"
      });

      // Remove olds ripples and add the new ripple element
      $tabsBlock.find(".ripple").remove();
      $el.prepend("<span class='ripple'></span>");

      const rippleDim = Math.max($el.width(), $el.height());
      const x = e.pageX - $el.offset().left - rippleDim / 2;
      const y = e.pageY - $el.offset().top - rippleDim / 2;

      // Add the ripples CSS and start the animation
      $tabsBlock.find(".ripple").css({
        width: rippleDim,
        height: rippleDim,
        top: y + 'px',
        left: x + 'px'
      }).addClass("rippleEffect");

      // Switch tabs
      const tabTarget = panelJQuery($el.data("href"));
      $tabsBlock.find(".tab-target.active").removeClass("active");
      tabTarget.addClass("active");
    });
  }

  return {
    onShown: onPanelShown
  };
}

