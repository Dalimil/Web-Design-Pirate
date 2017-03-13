

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


getStyleSheets().then(values => {
	console.log(values); // [ { source: "a.css", cssText: "body ..." }, ...]
});


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

