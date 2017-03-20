# Web Design Pirate

**Chrome DevTools Extension - Fast and easy way to copy web components, HTML widgets and parts of website design.**

## Motivation & Description
It is hard to look at a website and copy only a small part of it (widget/component/element). One could copy the full HTML and all CSS files and then try to filter out things we don't need, but that would take too much time.

**Web Design Pirate** is a DevTools extension that allows you to select an HTML node, and then gives you only the CSS styles that you need to render the full component. Optionally, for copying wrapper-style components it also allows you to specify the level of inner HTML content that can be thrown away (to further reduce the number of needed CSS styles).

## Examples
For instance I like Facebook's *Create a Post* widget. I select it using Chrome Developer Tools Inspector, switch to my Web Design Pirate tab, and copy the result.

## TODO
Add proper icons
Remove elements with display none
Do they want to copy any of the stylesheets? E.g. bootstrap --- Allow show/hide all CSS from that source + rerender
Slider to remove inner levels of HTML - show how many CSS lines it produces + rerender result + cache uncss calls

## Publish
https://developer.chrome.com/webstore/get_started_simple
