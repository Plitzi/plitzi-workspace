import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { FlowRun } from './flowRuns';
import type { DevStore } from '@plitzi/nexus';

/** An element as an agent asks about it: what it is, what it holds, and whether it is on screen. */
export type ElementReport = {
  id: string;
  type?: string;
  attributes?: Record<string, unknown>;
  /** What it reads: each binding's target, its source and, when it has one, its template. */
  bindings?: { category: string; to: string; source: string; template?: string }[];
  /** The element's own UI state — an open dropdown, a tab — as the runtime keeps it. */
  state?: unknown;
  /** How many copies are on the page: a list row's elements are one per row. */
  copies: number;
  visible: boolean;
  box?: { x: number; y: number; width: number; height: number };
};

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

/** A value as JSON can carry it: functions left out, a cycle cut, depth bounded. */
const plain = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'function') {
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (seen.has(value) || depth > 12) {
    return '[…]';
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => plain(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, plain(item, depth + 1, seen)])
      .filter(([, item]) => item !== undefined)
  );
};

const recordAt = (value: unknown, ...path: string[]): Record<string, unknown> => {
  let current = value;
  for (const key of path) {
    current = isRecord(current) ? current[key] : undefined;
  }

  return isRecord(current) ? current : {};
};

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** An element's bindings in one list, from the categories the document keeps them under. */
const bindingsOf = (element: unknown): NonNullable<ElementReport['bindings']> =>
  Object.entries(recordAt(element, 'definition', 'bindings')).flatMap(([category, list]) =>
    listOf(list).flatMap(binding => {
      const { to, source, transformers } = recordAt(binding);
      const template = listOf(transformers)
        .map(transformer => recordAt(transformer, 'params').template)
        .find(value => typeof value === 'string');

      return typeof to === 'string' && typeof source === 'string'
        ? [{ category, to, source, ...(typeof template === 'string' ? { template } : {}) }]
        : [];
    })
  );

const HELP = `window.__plitzi — this page, in text (debug mode only):
  state(key?)          runtime.state, or one key of it
  setState(key, value) writes runtime.state.<key>, as a setState step would
  sources(name?)       every source's current value by name (apiContainer_site, list_products…), or one
  element(id)          an element by its id: type, attributes, what it reads, its own state, copies, on screen, box
  flows(limit = 20)    the last flows that ran: trigger, element, status, every step with its time and error
  watch(on = true)     one console line per flow as it ends`;

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
    // parent's sources once per scope below it.
    const all: Record<string, unknown> = {};
    for (const store of [root, ...stores()]) {
      Object.assign(all, recordAt(store.getOwnState(), 'runtime', 'sources'));
    }

    return plain(name === undefined ? all : all[name]);
  },
  element: id => {
    const state = root.getState();
    const element = recordAt(state, 'schema', 'flat')[id];
    const nodes = Array.from(document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`));
    if (!isRecord(element) && nodes.length === 0) {
      return undefined;
    }

    const node = nodes.at(0);
    const rect = node?.getBoundingClientRect();
    const style = node ? getComputedStyle(node) : undefined;
    const visible =
      rect !== undefined &&
      rect.width > 0 &&
      rect.height > 0 &&
      style?.display !== 'none' &&
      style?.visibility !== 'hidden';
    const type = recordAt(element, 'definition').type;

    return {
      id,
      ...(typeof type === 'string' ? { type } : {}),
      ...(isRecord(element)
        ? { attributes: recordAt(plain(element), 'attributes'), bindings: bindingsOf(element) }
        : {}),
      ...(recordAt(state, 'runtime', 'elements')[id] === undefined
        ? {}
        : { state: plain(recordAt(state, 'runtime', 'elements')[id]) }),
      copies: nodes.length,
      visible,
      ...(rect
        ? {
            box: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          }
        : {})
    };
  },
  flows: (limit = 20) => runs().slice(-limit),
  watch: (on = true) => {
    setWatching(on);

    return on ? 'Each flow is said in the console as it ends.' : 'Flows are no longer said in the console.';
  }
});
