import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { elementReport, plain, recordAt } from './report';

import type { FlowRun } from './flowRuns';
import type { ElementReport } from './report';
import type { DevStore } from '@plitzi/nexus';

/** `window.__plitzi`: the page's state, data, elements and flows, in text, for whoever cannot read the panel. */
export type AgentInspector = {
  help: () => string;
  state: (key?: string) => unknown;
  setState: (key: string, value: unknown) => void;
  sources: (name?: string) => unknown;
  element: (id: string) => ElementReport | undefined;
  flows: (limit?: number) => FlowRun[];
  watch: (on?: boolean) => string;
};

export type AgentInspectorOptions = {
  /** The root store: the schema, `runtime.state`, every element's UI state. */
  root: DevStore;
  /** Writes one key of `runtime.state`, as a `setState` step does. */
  writeState: (key: string, value: unknown) => void;
  /** Every store the dev tools know — a provider's data lives in its own. */
  stores: () => readonly DevStore[];
  /** The flows that ran, newest last. */
  runs: () => readonly FlowRun[];
  /** Whether each flow is said in the console as it ends. */
  setWatching: (on: boolean) => void;
  document: Document;
};

const HELP = `window.__plitzi — this page, in text (debug mode only):
  state(key?)          runtime.state, or one key of it
  setState(key, value) writes runtime.state.<key>, as a setState step would
  sources(name?)       every source's current value by name (apiContainer_site, list_products…), or one
  element(id)          an element by its id, in a page or a component: type, attributes, what it reads, its own state,
                       the component it places, copies, on screen, box
  flows(limit = 20)    the last flows that ran: trigger, element, status, every step with its time and error
  watch(on = true)     one console line per flow as it ends`;

/** Whether a store's own value of a source is laid over one inherited from above: the merged value has keys it lacks. */
const extendsInherited = (own: unknown, merged: unknown): boolean =>
  isRecord(own) && isRecord(merged) && Object.keys(merged).some(key => !Object.hasOwn(own, key));

export const createAgentInspector = ({
  root,
  writeState,
  stores,
  runs,
  setWatching,
  document
}: AgentInspectorOptions): AgentInspector => ({
  help: () => HELP,
  state: key => {
    const state = recordAt(root.getState(), 'runtime', 'state');

    return plain(key === undefined ? state : state[key]);
  },
  setState: writeState,
  sources: name => {
    // Each store's own layer: a provider's source is in the store it seeds, and reading merged states would list a
    // parent's sources once per scope below it. A layer that extends a source a store above it holds is a scope's
    // view of that source — a list's row publishes `{ item, index }` under the list's own name — and never stands in
    // for it, whichever store registered first.
    const sources: Record<string, unknown> = {};
    const scoped: Record<string, unknown> = {};
    for (const store of [root, ...stores()]) {
      const inherited = recordAt(store.getState(), 'runtime', 'sources');
      for (const [key, own] of Object.entries(recordAt(store.getOwnState(), 'runtime', 'sources'))) {
        if (extendsInherited(own, inherited[key])) {
          scoped[key] = own;
        } else {
          sources[key] = own;
        }
      }
    }

    const all = { ...scoped, ...sources };

    return plain(name === undefined ? all : all[name]);
  },
  element: id => elementReport(root.getState(), id, document),
  flows: (limit = 20) => runs().slice(-limit),
  watch: (on = true) => {
    setWatching(on);

    return on ? 'Each flow is said in the console as it ends.' : 'Flows are no longer said in the console.';
  }
});
