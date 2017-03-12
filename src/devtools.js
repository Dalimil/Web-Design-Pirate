
const panelFilepath = "src/panel.html";
const iconFilepath = "images/icon128.png";

let firstInit = true;

// Create a new Devtools Panel
chrome.devtools.panels.create("Pirate", iconFilepath, panelFilepath, (thisPanel) => {
  // code invoked on panel creation

  thisPanel.onShown.addListener(panelWindow => {
    const $ = panelWindow.jQuery;

    console.log("user switched to this panel");
    if (firstInit) {
      firstInit = false;
      
      $("#loadLastInspected").click(() => {
        getLastInspectedElement().then(result => {
          console.log("Last inspected element", result);
          $("#inspectedResult").text(result);
        }).catch(() => {
          console.log("Nothing inspected recently.");
        });
      });
    }
  });

  function onElementSelectionChanged() {
    console.log("selection changed");
  }
  chrome.devtools.panels.elements.onSelectionChanged.addListener(onElementSelectionChanged);
});

function getLastInspectedElement() {
  // Use any CommandLine APIs inside eval() - e.g. $0 or inspect()
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval("$0.outerHTML", (result, exception) => {
      if (exception || !result) {
        reject(exception);
      } else {
        resolve(result);
      }
    });
  });
}
