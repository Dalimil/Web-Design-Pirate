# Web Design Pirate [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=EQYTWEHP59DJ2)

**Chrome DevTools Extension** :boat: :ghost: :anchor:  
Fast and easy way to copy full HTML widgets, components, and parts of web design.

<a href="https://github.com/Dalimil/Web-Design-Pirate">
  <img alt="Web Design Pirate - Chrome extension" src="https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/icon450.png" width="300">
</a>

## Motivation & Description
It is hard to look at a website and copy only a small part of it (widget/component/element). We could copy the full HTML and all CSS files and then try to filter out things we don't need, but that would take too much time...

**Web Design Pirate** is a DevTools extension that allows you to select an HTML node, and then gives you only the CSS styles that you need to render the full component. Optionally, for copying wrapper-style components it also allows you to specify the level of inner HTML content that can be thrown away (to further reduce the number of needed CSS styles).

## Examples
For instance I like MDN's header navigation widget. I select it using Developer Tools Inspector, switch to my Web Design Pirate tab, tweak the settings, and finally copy the result.

## Screenshots
*Current state:*

![Web Design Pirate - Screenshot](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-1.png)
![Web-Design-Pirate Screenshot - Dalimil](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-2.png)
![Web-Design-Pirate Extension - Dalimil](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-3.png)

![Web Design Pirate User Flow](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/flow.gif)

*Outdated (but still demonstrates the basic idea):*

![Web Design Pirate - Outdated screenshot](https://github.com/Dalimil/Web-Design-Pirate/blob/master/images/screenshot-old.png)


## Dev
**Pull requests welcome**

### TODO
- For large chunks of HTML (e.g. Expedia html body) it is too slow (devtools freeze) - maybe remove deep level innerHTML already in content scripts (assume user interest in the wrapper element)
- Publish: https://developer.chrome.com/webstore/get_started_simple
