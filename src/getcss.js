


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
	console.log(values); // [ "stylesA", "stylesB", ... ]
});