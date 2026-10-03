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
 * Puts the selected instance's state, sources, elements and flows on `window.__plitzi`, while the dev tools are on.
 *
 * The panel shows all of it to a person; an agent driving the page through a browser reads text, and was left inferring
 * state from classes in the DOM. Every flow that ends is kept from the moment the dev tools mount.
 */
const useAgentInspector = (enabled: boolean): void => {
  const root = useContext(StoreContext);
  const setCommon = useCommonStoreSetter();

  useEffect(() => {
    if (!enabled || !root) {
      return;
    }

    const runs: FlowRun[] = [];
    let watching = false;
    const stopListening = pConsole.addListener(log => {
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
    });
    const inspector = createAgentInspector({
      root,
      writeState: (key, value) => setCommon(`runtime.state.${key}`, value),
      stores: () => getDevStoresSnapshot().map(entry => entry.store),
      runs: () => runs,
      setWatching: on => {
        watching = on;
      },
      document
    });
    window.__plitzi = inspector;

    return () => {
      stopListening();
      if (window.__plitzi === inspector) {
        delete window.__plitzi;
      }
    };
  }, [enabled, root, setCommon]);
};

export default useAgentInspector;
