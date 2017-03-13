

/**
 * Return CSS text of all stylesheets in the page
 */
function getStyleSheets() {
	const styleSheets = [].slice.call(document.styleSheets);

	return Promise.all(styleSheets.map(sheet => {
		if (sheet.href) {
			return fetch(sheet.href).then(data => data.text());
		} else if (sheet.cssRules) {
			return Promise.resolve(
				[].slice.call(sheet.cssRules).map(r => r.cssText).join(" \n")
			);
		}
		return Promise.resolve(null);
	})).then(values => {
		return values.filter(v => v != null).map((v, i) => {
			return {
				source: styleSheets[i].href || "inline",
				cssText: v
			};
		});
	});
}


/**
 * Return simplified CSS (based on given HTML and CSS)
 * Use test API: https://github.com/giakki/uncss 
 *
 * Alternative solution: Use https://github.com/reworkcss/css
 * 	and document.querySelector() each of the CSS selectors to check if result is null
 */
function uncss(inputHtml, inputCss) {
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
		return data.outputCss;
	});
}

// We only need to get stylesheets once
const stylesheets = getStyleSheets();

/**
 * Merge all stylesheets, remove unneeded CSS by calling uncss api,
 * return simplified css string and stats about usage of individual sources
 */
function getCssForHtml(inputHtml) {
	const separator = "/* ---sep--- */";
	const blockCommentRegexp = /\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g;

	return stylesheets.then(values => {
		// values = [ { source: "a.css", cssText: "body ..." }, ...]

		const allCss = values.map(x => x.cssText).join(separator);

		return uncss(inputHtml, allCss).then(outputCss => {
			const cssPieces = outputCss.split(separator);
			if (cssPieces.length != values.length) {
				throw new Error("API-returned CSS is not in expected format.");
			}
			return cssPieces.map((v, i) => ({
				source: values[i].source,
				cssText: v.replace(blockCommentRegexp, "").trim()
			}));
		}).then(cssPieces => {
			const stats = cssPieces.map(({ source, cssText }) => ({
				source,
				usage: cssText.length
			}));

			const cssString = cssPieces.map(({ source, cssText }) =>
				`/** ----- ${source} ----- */\n${cssText}`).join("\n");

			return {
				stats,
				css: cssString
			};
		});
	});
}

