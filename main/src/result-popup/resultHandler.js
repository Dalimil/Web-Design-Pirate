// Code running in a popup
//  it handles updates to the rendered result HTML when it receives a message from the background page

const $iframe = document.querySelector("#result");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Careful, it receives same messages as background.js (ignore those)
  if (message.requestType == "result-html-update") {
    $iframe.srcdoc = message.htmlString;
    console.log(`Updated: ${new Date().toLocaleTimeString()}`);
    sendResponse("done");
  }
});
