// This is all required to simulate a browser environment in React tests.
const jsdom = require('jsdom');
const document = new jsdom.JSDOM("");
const window = document.window;

global.document = window.document
global.window = window
window.console = global.console

Object.keys(window).forEach((property) => {
  if (typeof global[property] === 'undefined') {
    global[property] = window[property];
  }
});

global.navigator = {
  userAgent: 'node.js'
};

const enzyme = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
enzyme.configure({ adapter: new Adapter() });