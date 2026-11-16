import { use } from 'react';

import { NetworkContext } from '../network/react';

/**
 * Asks the page to run `script` as soon as it is parsed — before it paints, before React is there — for what an element
 * draws by a fact only the browser knows (the address's hash): the server draws without it, and the page would show
 * the server's drawing until hydration. Written into the server render's result (`SSRRenderResult.prePaint`), once per
 * name however many elements ask, and run by the page with its own script policy. In the browser it does nothing: the
 * element draws by the fact itself there, and must hydrate on what the script left in the document.
 *
 * `enabled` false asks for nothing — an element that needs it only as it is configured. `script` is a function of plain JavaScript that reads nothing but the document and the window — its source is what
 * the page runs, so it may close over nothing.
 */
const usePrePaint = (name: string, script: () => void, enabled = true): void => {
  const { server } = use(NetworkContext);
  const result = server.ssr?.renderResult;
  if (!result || !enabled) {
    return;
  }

  result.prePaint ??= {};
  result.prePaint[name] ??= `(${script.toString()})();`;
};

export default usePrePaint;
