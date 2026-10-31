import { useContext, useEffect } from 'react';

import { getDevStoresSnapshot } from '@plitzi/nexus';
import { StoreContext } from '@plitzi/nexus/react';
import { pConsole } from '@plitzi/sdk-shared/devTools';
import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import { flowRunLine, flowRunOf } from './flowRuns';
import { createAgentInspector } from './inspector';

import type { FlowRun } from './flowRuns';
import type { AgentInspector } from './inspector';

declare global {
  interface Window {
    /** This page, in text, for an agent — see `window.__plitzi.help()`. Present in debug mode only. */
    __plitzi?: AgentInspector;
  }
}

/** The flows kept for `flows()`: enough to follow a page for a while, few enough to cost nothing. */
const KEPT_RUNS = 100;

/**
 * Puts the selected instance's state, sources, elements and flows on `window.__plitzi`, while the dev tools are on — or
 * on another window's, `target`: the builder's canvas is an iframe whose document the SDK draws in from the editor's.
 *
 * The panel shows all of it to a person; an agent driving the page through a browser reads text, and was left inferring
 * state from classes in the DOM. Every flow that ends is kept from the moment the dev tools mount.
 */
const useAgentInspector = (enabled: boolean, target?: Window | null): void => {
  const root = useContext(StoreContext);
  const setCommon = useCommonStoreSetter();

  useEffect(() => {
    const on = target === undefined ? window : target;
    if (!enabled || !root || !on) {
      return;
    }

    const runs: FlowRun[] = [];
    let watching = false;
    const stopListening = pConsole.addListener(
      log => {
        const run = flowRunOf(log);
        if (!run) {
          return;
        }

        runs.push(run);
        if (runs.length > KEPT_RUNS) {
          runs.shift();
        }

        if (watching) {
          // The point of `watch()`: the console is what an agent driving a browser can read.

          console.info(flowRunLine(run));
        }
      },
      { replay: true }
    );
    const inspector = createAgentInspector({
      root,
      writeState: (key, value) => setCommon(`runtime.state.${key}`, value),
      writeTestAccount: account => setCommon('runtime.testAccount', account),
      stores: () => getDevStoresSnapshot().map(entry => entry.store),
      runs: () => runs,
      setWatching: on => {
        watching = on;
      },
      elementSources: id => pConsole.providerData(`getElementDataSource-${id}`),
      document: on.document
    });
    on.__plitzi = inspector;

    return () => {
      stopListening();
      if (on.__plitzi === inspector) {
        delete on.__plitzi;
      }
    };
  }, [enabled, root, setCommon, target]);
};

export default useAgentInspector;
