# Web Design Pirate

**Chrome DevTools Extension** :boat: :ghost: :anchor:  
Fast and easy way to copy full HTML widgets, components, and parts of web design.

<a href="https://github.com/Dalimil/Web-Design-Pirate">
  <img alt="Web Design Pirate - Chrome extension" src="https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/icon450.png" width="300">
</a>

## Motivation & Description
It is hard to look at a website and copy only a small part of it (widget/component/element). One could copy the full HTML and all CSS files and then try to filter out things we don't need, but that would take too much time...

**Web Design Pirate** is a DevTools extension that allows you to select an HTML node, and then gives you only the CSS styles that you need to render the full component. Optionally, for copying wrapper-style components it also allows you to specify the level of inner HTML content that can be thrown away (to further reduce the number of needed CSS styles).

## Examples
For instance I like Facebook's *Create a Post* widget. I select it using Chrome Developer Tools Inspector, switch to my Web Design Pirate tab, and copy the result.

## TODO
- Copy progressbar style: http://propeller.in/components/progressbar.php (or use http://progressbarjs.readthedocs.io/en/latest/#install)
- Add loading spinner indicator? Pulling stylesheets progress? http://materializecss.com/preloader.html
- Add a help icon with tooltip explaining usage
- It's painfully slow (devtools freeze) for large chunks of HTML (e.g. expedia html body) - maybe remove deep level innerHTML already in content scripts (assume interest in wrapper element)
- Perform repeated uncss requests with reduced css (from previous calls) and only first call with all stylesheets; Also cache responses for different tree slider values
- Publish: https://developer.chrome.com/webstore/get_started_simple

## Screenshots
*Current state:*

![Web Design Pirate](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot.png)

*Outdated:*

![Web Design Pirate - Work in Progress](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-wip.png)
![Web Design Pirate - Work in Progress 2](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-wip2.png)
