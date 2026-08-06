import { render } from '@plitzi/plitzi-sdk';

import { offlineData } from '@plitzi/example-space/browser';

import '@plitzi/plitzi-sdk/plitzi-sdk.css';

/** The whole example.
 *
 *  `offlineMode` is what makes this run with no backend: the SDK renders the `{ schema, style }` it is handed
 *  instead of fetching a space, so there is no account, no API key and no server in the picture. Point
 *  `offlineData` at your own export and this renders that instead. */
render('plitzi-root', {
  offlineMode: true,
  offlineData,
  environment: 'main'
});
