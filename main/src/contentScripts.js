/**
 * These scripts need to be EVALuated within the context of the currently inspected page 
 * We do that using chrome API's eval function within devtools.js 
 */
const contentScripts = (() => {
  /**
   * Return CSS text of all stylesheets in the page
   *  or only a href if the stylesheet is external
   */
  function getStyleSheets() {
    return [].slice.call(document.styleSheets).map((x) => (
      {
        href: x.href,
        cssText: (x.hasOwnProperty('rules') && x.cssRules && x.cssRules.length) ? [].slice.call(x.cssRules).map(r => r.cssText).join(" \n") : null,
      }
    )).filter(v => v.href || v.cssText);
  }

  /**
   * Return HTML of last inspected element + full page HTML source
   * Exception when $0 is null is captured by windowEval Promise reject
   */
  function getLastInspectedElement() {
    if ($0 == null) {
      throw "Select an element using the inspector first.";
    }
    const invalidElementError = "Invalid element selected. (needs to be inside the body tag)";
    let u = $0;
    if (u.nodeName.toLowerCase() == "body") {
      // the whole <body> is often too big and also is the tag selected by default when
      // switched to Inspector tab, so it might not be what user wants
      // + pirating the whole body (rather than a single element) is nonsensical
      throw invalidElementError;
    }
    let fullHtml = $0.outerHTML;
    try {
      while (u.nodeName.toLowerCase() != "body") {
        u = u.parentNode;
        fullHtml = u.outerHTML.replace(u.innerHTML, fullHtml);
      }
    } catch (e) {
      throw invalidElementError;
    }
    
    return {
      element: $0.outerHTML,
      fullHtml,
      href: window.location.href
    };
  }

  /** Helper functions */
  function toEvalString(functionRef) {
    // functions must return immediately (no Promises inside allowed)
    return `(${functionRef.toString()})()`;
  }

  function windowEval(functionRef) {
    const evalString = toEvalString(functionRef);

    // Use any CommandLine APIs inside eval() - e.g. $0 or inspect()
    return new Promise((resolve, reject) => {
      chrome.devtools.inspectedWindow.eval(evalString, (result, exception) => {
        if (exception) {
          reject(exception);
        } else {
          resolve(result);
        }
      });
    });
  }

  return {
    getStyleSheets: () => windowEval(getStyleSheets),
    getLastInspectedElement: () => windowEval(getLastInspectedElement)
  };
})();

