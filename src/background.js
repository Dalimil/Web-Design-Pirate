// Background extension page - Event page (only runs based on event listeners)
// Console log messages won't be shown (only shown in special console)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.requestType == "stylesheets") {
		fetchStyleSheetContent(message.styleSheets)
			.then(sendResponse)
			.catch(e => sendResponse(e.toString()));
	} else if (message.requestType == "uncss") {
		getCssForHtml(message.inputHtml, message.styleSheets)
			.then(sendResponse)
			.catch(e => sendResponse(e.toString()));
	} else if (message.requestType == "result-window") {
		getResultWindow(message.windowId)
			.then(({ win, isNew }) => {
				const notifyResultPopup = () => {
					chrome.tabs.sendMessage(win.tabs[0].id, {
						requestType: "result-html-update",
						htmlString: message.htmlString
					}, () => sendResponse(win.id)); // exit onResponse
				};
				if (isNew) {
					// JS msg-receiving code is not ready immediately (fix)
					setTimeout(notifyResultPopup, 1000);
				} else {
					notifyResultPopup();
				}
			})
			.catch(e => sendResponse(e.toString()));
	} else {
		sendResponse("invalid");
	}
	return true; // keep open until sendResponse is called (async)
});


/**
 * Get a reference to a popup window where we render result
 * 	Creates a new popup window if no previous exists
 */
function getResultWindow(windowId) {
	const createNewWindow = () => new Promise(resolve => {
		const popupUrl = "src/result-popup/popup.html";
		chrome.windows.create({ url: popupUrl, type: 'popup' }, newWin => {
			resolve({ win: newWin, isNew: true });
		});
	});
	if (typeof windowId !== "number") {
		return createNewWindow();
	}
	return new Promise((resolve, reject) => {
		chrome.windows.get(windowId, { populate: true }, (myWindow) => {
			if (myWindow) {
				resolve({ win: myWindow, isNew: false });
			} else {
				createNewWindow().then(resolve);
			}
		});
	});
}

/** Fetching CSS stylesheets from anywhere
 *  -> CORS issue so it has to be done in background.js
 */
function fetchStyleSheetContent(styleSheets) {
  return Promise.all(styleSheets.map(sheet => {
    if (sheet.cssText) {
      return Promise.resolve(sheet.cssText);
    } else if (sheet.href && sheet.href.startsWith("http")) {
      return fetch(sheet.href).then(data => data.text());
    }
    return Promise.resolve(null);
  })).then(values => {
		let internalSeqId = 0;
    // zip hrefs back and filter out nulls
    return values.map((v, i) => {
			let source = styleSheets[i].href;
			let isInternal = false;
			if (!source) {
				source = `internal_${internalSeqId}`;
				isInternal = true;
				internalSeqId += 1;
			}
			const pathname = new URL(source, "https://example.com/").pathname;
      return {
        source,
				isInternal,
				filename: pathname.substring(pathname.lastIndexOf('/') + 1),
        cssText: v
      };
    }).filter(x => x.cssText != null);
  });
}


/**
 * Merge all stylesheets, remove unneeded CSS by calling uncss api,
 * return simplified css string and stats about usage of individual sources
 */
function getCssForHtml(inputHtml, styleSheets) {
	// styleSheets = [ { source: "a.css", cssText: "body ..." }, ...]
	const separator = "/*****-----sep-----*****/";
	const blockCommentRegexp = /\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g;
	const allCss = styleSheets.map(x => x.cssText).join(`\n\n${separator}\n\n`);

	return _uncss(inputHtml, allCss).then(outputCss => {
		const cssTextPieces = outputCss.split(separator);
		if (cssTextPieces.length != styleSheets.length) {
			throw new Error(`API-returned CSS is not in expected format.
				${cssTextPieces.length} - ${styleSheets.length}`);
		}
		const cssPieces = cssTextPieces.map((v, i) => {
			return {
				source: styleSheets[i].source,
				isInternal: styleSheets[i].isInternal,
				filename: styleSheets[i].filename,
				cssText: v.replace(blockCommentRegexp, "").trim()
			};
		}).filter(sheet => sheet.cssText.length != 0);

		return {
			cssPieces
		};
	});
}

/**
 * Return simplified CSS (based on given HTML and CSS)
 * Use test API: https://github.com/giakki/uncss 
 *
 * Alternative solution: Use https://github.com/reworkcss/css
 * 	and document.querySelector() each of the CSS selectors to check if result is null
 */
function _uncss(inputHtml, inputCss) {
	const testServerUrl = "https://uncss-online.com/uncss";
	const formData = new FormData();
	formData.append("inputHtml", inputHtml);
	formData.append("inputCss", inputCss);
	formData.append("type", "fetch");
	return fetch(testServerUrl, {
		method: "POST",
		body: formData
	}).then(data => data.json())
	.then(data => {
		if (data.error) {
			throw data.error;
		}
		return data.outputCss.replace(/\\r\\n/g, "\n");
	});
}

