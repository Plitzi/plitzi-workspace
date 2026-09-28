import { render } from '@plitzi/plitzi-sdk';

import { offlineData } from './space';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

/**
 * The same space, rendered by the browser alone.
 *
 * `offlineMode` is what makes it run with no backend: the SDK renders the `{ schema, style }` it is handed. Which
 * means there is no `server.ssr` block on this page, and therefore no action endpoint and no RSC path — and that
 * absence is the whole example. A step that would run on a server reports itself skipped, and a `runtime: 'server'`
 * element renders its mock, both without a single request.
 *
 * `debugMode` opens the dev-tools panel, where the skipped step is logged with its reason. Without it the step is
 * still inert; you just have nowhere to see why.
 */
render('plitzi-root', {
  offlineMode: true,
  // Without this the SDK renders inside an IFRAME — its default, and the safe one for a space dropped into a page
  // it knows nothing about. This page is ours.
  renderMode: 'raw',
  debugMode: true,
  offlineData,
  environment: 'main'
});
