
// Create a new Devtools Panel
chrome.devtools.panels.create("Pirate",
    "MyPanelIcon.png",
    "panel.html",
    function(thisPanel) {
      // code invoked on panel creation

      thisPanel.onShown.addListener((panelWindow) => {
        console.log("user switched to this panel");
      });

      function onSelectionChanged() {
        console.log("selection changed");
      }

      chrome.devtools.panels.elements.onSelectionChanged.addListener(onSelectionChanged);
    }
);