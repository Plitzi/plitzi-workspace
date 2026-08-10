import { render } from '@plitzi/plitzi-sdk';

import { offlineData } from '@plitzi/example-space/browser';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

/** The whole example.
 *
 *  `offlineMode` is what makes this run with no backend: the SDK renders the `{ schema, style }` it is handed
 *  instead of fetching a space, so there is no account, no API key and no server in the picture. Point
 *  `offlineData` at your own export and this renders that instead. */
render('plitzi-root', {
  offlineMode: true,
  // Without this the SDK renders the space inside an IFRAME — its default, because a space dropped into an
  // unknown page is safest isolated from it. Here the page is ours, so render straight into the DOM: one
  // document, one stylesheet, no frame borders and no scroll traps.
  renderMode: 'raw',
  offlineData,
  environment: 'main'
});
