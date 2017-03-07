
// Create a new Devtools Panel
chrome.devtools.panels.create("Pirate", "icon128.png", "panel.html", (thisPanel) => {
  // code invoked on panel creation

  thisPanel.onShown.addListener((panelWindow) => {
    console.log("user switched to this panel");
  });

  function onSelectionChanged() {
    console.log("selection changed");
  }
  chrome.devtools.panels.elements.onSelectionChanged.addListener(onSelectionChanged);

  getLastInspectedElement().then(result => {
    console.log("Last inspected element", result);
  }).catch(() => {
    console.log("Nothing inspected recently.");
  });
});

function getLastInspectedElement() {
  // Use any CommandLine APIs inside eval() - e.g. $0 or inspect()
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval("$0", (result, exception) => {
      if (exception || !result) {
        reject(exception);
      } else {
        resolve(result);
      }
    });
  });
}
