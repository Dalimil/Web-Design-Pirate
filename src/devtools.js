
const panelFilepath = "src/panel.html";
const iconFilepath = "images/icon128.png";

// Create a new Devtools Panel
chrome.devtools.panels.create("Pirate", iconFilepath, panelFilepath, (thisPanel) => {
  // Panel created
  let panel = null;

  thisPanel.onShown.addListener(panelWindow => {
    // User switched to this panel
    if (panel == null) {
      panel = new PanelEnvironment(panelWindow);
    }
    panel.onShown(panelWindow);
  });

});

function getLastInspectedElement() {
  const expr = `JSON.stringify({
    element: $0.outerHTML,
    source: document.documentElement.outerHTML
  });`;
  // Use any CommandLine APIs inside eval() - e.g. $0 or inspect()
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expr, (result, exception) => {
      if (exception || !result) {
        reject(exception);
      } else {
        resolve(JSON.parse(result));
      }
    });
  });
}

function PanelEnvironment(panelWindow) {
  const $ = panelWindow.jQuery;
  const $loadLastInspected = $("#loadLastInspected");
  const $resultDisplay = $("#inspectedResult");

  $loadLastInspected.click(showLastInspected);
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
    getLastInspectedElement().then(result => {
      console.log($(result));
      $resultDisplay.html(result.element);
    }).catch(e => {
      console.log(e);
      $resultDisplay.text("Nothing inspected recently.");
    });
  }

  return {
    onShown: onPanelShown
  };
}


