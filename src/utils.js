// global variables: 
// html_beautify, css_beautify, cssParser


const Log = (...args) => console.log.apply(console, args);

/**
 * Static utils that perform various operations on css and html strings
 */
const Utils = {
  combineCssPieces(cssPieces, minifyCss) {
    const hrString = Array(minifyCss ? 10 : 70).join("-");
    const cssString = cssPieces.map(({ source, cssText }) =>
      `/* ${hrString}\n * ${source} \n * ${hrString} \n */\n\n${cssText}`
    ).join("\n\n");

    return minifyCss ? Utils.minifyCssString(cssString) : css_beautify(cssString);
  },

  minifyCssString(cssString) {
    const invSplitter = "_A_A_";
    const beautified = css_beautify(cssString, { indent_size: 1, indent_char: " " }) + "\n";
    return beautified
      .replace(/\n}\r?\n/g, invSplitter) // mark lines of future interest
      .replace(/\r?\n/g, "") // remove all newlines
      .replace(new RegExp(invSplitter, 'g'), "}\n") // put lines of interest back
      .replace(/\*\//g, "*/\n"); // fix block comments ending
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

  removeScriptTags(htmlString) {
    let $html = Utils.transformHtmlToJQuery(htmlString);
    $html.find('script').remove();
    return Utils.transformJQueryToHtml($html);
  },

  normalizeRawHtml(rawHtmlString, baseUrl) {
    Log("Raw html length: ", rawHtmlString.length);
    const options = {
      indent_size: 2,
      wrap_line_length: 0, // disable (max char per line)
      preserve_newlines: false
    };
    const beautified = html_beautify(Utils.removeScriptTags(rawHtmlString), options);
    if (!baseUrl || typeof baseUrl != "string") {
      return beautified;
    }
    return Utils.replaceRelativePaths(beautified, baseUrl);
  },

  randomString(len) {
    // max len ~ 20
    return (Math.random() + 1).toString(36).substr(2, len);
  },

  addCssModuleScopeClass(cssString, minifyCss) {
    try {
      const classModulePrefix = `__${Utils.randomString(6)}`;
      const cssAst = cssParser.parse(cssString, { silent: false });
      const modifyInTree = (tree) => {
        tree.rules.forEach(rule => {
          if (rule.type == "media") {
            modifyInTree(rule); // recurse
          } else if (rule.selectors) {
            rule.selectors = rule.selectors.map(s => `${classModulePrefix} ${s}`);
          }
        });
      };
      modifyInTree(cssAst.stylesheet);
      // Log(cssAst);
      const resultCssString = cssParser.stringify(cssAst);
      return minifyCss ? Utils.minifyCssString(resultCssString) : resultCssString;
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

    const countDepth = ($node) => {
      if ($node.children().length == 0) {
        return 1;
      }
      let max = 0;
      $node.children().each((ind, el) => {
        max = Math.max(max, countDepth(jQuery(el)));
      });
      return max + 1;
    };
    return countDepth($html);
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
    const removeDeeperThan = ($element, maxDepth) => {
      /*if ($element.children().length == 0) {
        return;
      }*/
      if (maxDepth <= 0) {
        return $element.empty();
      }
      $element.children().each((ind, el) => {
        removeDeeperThan(jQuery(el), maxDepth-1);
      });
    };
    removeDeeperThan($html, levelEnd - levelStart);
    
    return Utils.transformJQueryToHtml($html);
  }
};
