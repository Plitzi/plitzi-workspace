// jsdom ships no bundled types and we don't want to add @types/jsdom just for a benchmark; the surface used here is
// tiny and exercised at runtime by the bench itself.
// @ts-expect-error -- no type declarations for 'jsdom'
import { JSDOM } from 'jsdom';

// react-dom needs a browser-like global environment before it can render. The React-render benchmark imports this
// first (a side-effecting module) so `document` and friends exist by the time `react-dom/client` is loaded. jsdom is
// hoisted at the workspace root; vite-node resolves it from there.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});

const globals = globalThis as unknown as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
// `navigator` is a read-only getter on Node's globalThis, so it can't be assigned like the rest.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globals.HTMLElement = dom.window.HTMLElement;
globals.Node = dom.window.Node;
globals.Event = dom.window.Event;
globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globals.requestAnimationFrame = (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0);
globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
