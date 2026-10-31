import { isRecord } from '@plitzi/sdk-shared/helpers';

import { elementReport, findElement, plain, recordAt } from './report';

import type { FlowRun } from './flowRuns';
import type { ElementReport } from './report';
import type { DevStore } from '@plitzi/nexus';

/** `window.__plitzi`: the page's state, data, elements and flows, in text, for whoever cannot read the panel. */
export type AgentInspector = {
  help: () => string;
  state: (key?: string) => unknown;
  setState: (key: string, value: unknown) => void;
  sources: (name?: string) => unknown;
  /**
   * The source written — by its name, or the one an element's id names (`<type>_<id>`) — false when none holds it, or why
   * it was not written (`refused`): what is written there no element would draw.
   */
  setSource: (path: string, value: unknown) => string | false | Refused;
  /**
   * An element's attribute given a value, as a page binding it would (`<id>.<attribute>`): the element it was written
   * on, or false when the space has none by that id — a plugin's new attribute seen drawn before any page binds it.
   */
  setAttribute: (path: string, value: unknown) => string | false | Refused;
  element: (id: string) => ElementReport | undefined;
  flows: (limit?: number) => FlowRun[];
  /** Why each server element failed on the page server since the page loaded, by id — answered later or not. */
  serverFailures: () => Record<string, unknown>;
  watch: (on?: boolean) => string;
};

/** A write refused, and why: a value that would be written and drawn over, or written where nothing reads it. */
export type Refused = { refused: string };

/** The binding that gives an element's attribute, when one does: what it is drawn from, whatever is written on it. */
const bindingOf = (element: Record<string, unknown>, attribute: string): string | undefined => {
  const definition = isRecord(element.definition) ? element.definition : {};
  const bindings = isRecord(definition.bindings) ? definition.bindings : {};
  // `Array.isArray` narrows to `any[]`: read back as `unknown[]`, each binding is checked before it is used.
  const found = Object.values(bindings)
    .flatMap((each): unknown[] => (Array.isArray(each) ? (each as unknown[]) : []))
    .find(binding => isRecord(binding) && binding.to === attribute && binding.enabled !== false);

  return isRecord(found) && typeof found.source === 'string' ? found.source : undefined;
};

/** What a list's row reads as its own, from the list's items: never a value of the list's source to write. */
const ROW_KEYS = new Set(['item', 'index']);

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
  /** The sources an element sees, by its id — its scope's, a list row's included: what its bindings read. */
  elementSources?: (id: string) => unknown;
  document: Document;
};

const HELP = `window.__plitzi — this page, in text (debug mode only):
  state(key?)          runtime.state, or one key of it
  setState(key, value) writes runtime.state.<key>, as a setState step would
  sources(name?)       every source's current value by name (apiContainer_site, list_products…), or one
  setAttribute(path, value)
                       an element's attribute given a value (map.storms), as a page binding it would — refused, saying
                       why, for one a binding gives (write its source)
  setSource(path, value)
                       writes a source, or a path in it (apiContainer_site.items — or by its element, site.items),
                       where its provider keeps it — what the page shows filled; until the provider answers again.
                       A list row's item is refused: it comes from the list's items
  element(id)          an element by its id, in a page or a component: type, attributes, what it reads and what each
                       binding gave it (resolved), its own state, the component it places, copies, on screen, box
  flows(limit = 20)    the last flows that ran: trigger, element, status, every step with its time and error
  serverFailures()     why each server element failed on the page server since the page loaded, by id
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
  elementSources,
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
  setSource: (path, value) => {
    const [asked = '', ...rest] = path.split('.');
    // The store whose own layer seeds it — the provider's — never a scope below that only extends it (a list's row).
    const holderOf = (name: string) =>
      [root, ...stores()].find(store => {
        const own = recordAt(store.getOwnState(), 'runtime', 'sources')[name];

        return own !== undefined && !extendsInherited(own, recordAt(store.getState(), 'runtime', 'sources')[name]);
      });
    // An element's id where its source's name was meant: a source is `<type>_<id>` (`getSourceName`), and a run's
    // designer wrote `tornadoes-feed.recent` of the apiContainer it named — refused, until it found apiContainer_….
    const byId = [
      ...new Set(
        [root, ...stores()].flatMap(store =>
          Object.keys(recordAt(store.getOwnState(), 'runtime', 'sources')).filter(
            key => key.slice(key.indexOf('_') + 1) === asked && key.includes('_')
          )
        )
      )
    ];
    const name = holderOf(asked) || byId.length !== 1 ? asked : (byId[0] ?? asked);
    // A list's row is each row's own, made from the list's items: a run's designer wrote strongestPick.item and saw
    // nothing change, and nothing said why.
    const rowKey = rest.at(0);
    if (name.startsWith('list_') && rowKey !== undefined && ROW_KEYS.has(rowKey)) {
      const list = findElement(recordAt(root.getState(), 'schema'), name.slice('list_'.length)).element;
      const items = isRecord(list) ? bindingOf(list, 'items') : undefined;

      return {
        refused: `${name}.${rest.join('.')} is each row's own — a list's ${rowKey} comes from its items${items ? `, bound from ${items}: write that source (setSource('${items}', …))` : `: write ${name}.items`}`
      };
    }

    const holder = holderOf(name);
    // A plain string: a template literal type is read through the store's own types, which know no source by name.
    const at: string = `runtime.sources.${[name, ...rest].join('.')}`;
    holder?.setState(at, value);

    return holder === undefined ? false : name;
  },
  setAttribute: (path, value) => {
    const [id = '', ...name] = path.split('.');
    const { element, inComponent } = findElement(recordAt(root.getState(), 'schema'), id);
    if (!isRecord(element) || name.length === 0) {
      return false;
    }

    // Given by a binding, a value written is drawn over at once: said, never written as if it had taken.
    const [attribute = ''] = name;
    const bound = bindingOf(element, attribute);
    if (bound !== undefined) {
      return {
        refused: `${id}.${attribute} is given by its binding, from ${bound}: what is written on it is drawn over at once — write what it reads (setSource('${bound}', …))`
      };
    }

    // A plain string: a template literal type is read through the store's own types, which know no element by id.
    const at: string = `schema.${inComponent === undefined ? '' : `components.${inComponent}.`}flat.${id}.attributes.${name.join('.')}`;
    root.setState(at, value);

    return id;
  },
  element: id => elementReport(root.getState(), id, document, elementSources),
  flows: (limit = 20) => runs().slice(-limit),
  serverFailures: () => recordAt(root.getState(), 'rsc', 'failures'),
  watch: (on = true) => {
    setWatching(on);

    return on ? 'Each flow is said in the console as it ends.' : 'Flows are no longer said in the console.';
  }
});
