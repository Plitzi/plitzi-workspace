import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { closest } from '../suggest';
import { LintContext } from './context';
import { isPlainContainer } from './elements';
import { STATE_PATH_PARAMS } from './flows';

import type { LintCatalogs } from './context';
import type { Element, ElementBinding, ElementInteraction, Schema, Style } from '@plitzi/sdk-shared';
import type { ParamSpec } from '@plitzi/sdk-shared/authoring/paramSpec';

/**
 * A change a fix made, in the words the author wrote it with: an attribute, one of the element's own fields
 * (`visible`), a binding by its target, or a field of one of its steps (`on`, a param). What lets the same fix be
 * offered as an edit to the source that wrote the element, as well as made to its document.
 */
export interface FixChange {
  on: 'attribute' | 'field' | 'binding' | { step: string };
  /**
   * `replace` swaps one literal text for another anywhere under the key — a transformer's action in a binding.
   * `unwrap` puts what the key holds — an object — in its place, one level up: `attributes: { value: 5 }` → `value: 5`.
   */
  op: 'remove' | 'rename' | 'set' | 'replace' | 'unwrap';
  /** The attribute, field or param; a binding's target; the text `replace` looks for. */
  key: string;
  /** What `rename` renames to, and what `replace` writes. */
  to?: string;
  /** What `set` writes. */
  value?: string | number | boolean;
}

/** One change a fix made, said the way the problems list says the issue it settles. */
export interface AppliedFix {
  code: string;
  elementId: string | null;
  message: string;
  /** The change itself, when there is one way to write it in the source; a message alone otherwise. */
  change?: FixChange;
}

export interface FixResult {
  schema: Schema;
  style: Style;
  applied: AppliedFix[];
}

type Report = (message: string, change?: FixChange) => void;
/** A fix of one element, read with the context the linter reads it with — the same names, the same instances. */
type Fixer = (element: Element, ctx: LintContext, report: Report) => void;

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** A page target that is really a URL: the one reading of `mailto:`/`https:` a page-mode link can never mean. */
const isUrlTarget = (target: unknown): target is string =>
  typeof target === 'string' && !hasTemplateSyntax(target) && URL_SCHEME.test(target);

const isRoot = (element: Element): boolean => !element.definition.parentId;

const stepsOf = (element: Element): ElementInteraction[] => Object.values(element.definition.interactions ?? {});

/**
 * A key the element or step does not take, renamed to the one it was a typo of — when that one is free — or dropped:
 * it was never read, so dropping it changes nothing on screen.
 */
const settleUnknownKeys = (
  record: Record<string, unknown>,
  known: readonly string[],
  what: string,
  on: FixChange['on'],
  report: Report,
  /** What each key reads when left out: one that holds only that is free to be written. */
  defaults: Record<string, unknown> = {}
) => {
  for (const key of Object.keys(record)) {
    if (known.includes(key)) {
      continue;
    }

    // What the author meant, wrapped one level too deep — `attributes: { value: 5 }` where `value: 5` was meant: put
    // in its place, up where it is read. Only when every key is one it reads and none is written already beside it;
    // anything else is not guessed at, and no less is it dropped.
    const wrapped = record[key];
    if (isRecord(wrapped) && Object.keys(wrapped).length > 0 && Object.keys(wrapped).every(inner => known.includes(inner))) {
      const inners = Object.keys(wrapped);
      if (inners.every(inner => record[inner] === undefined || record[inner] === defaults[inner])) {
        Object.assign(record, wrapped);
        Reflect.deleteProperty(record, key);
        report(
          `Moved ${inners.join(', ')} out of the ${what} "${key}", up to where ${inners.length === 1 ? 'it is' : 'they are'} read.`,
          { on, op: 'unwrap', key }
        );
      }

      continue;
    }

    const meant = closest(key, known);
    if (meant !== undefined && record[meant] === undefined) {
      record[meant] = record[key];
      report(`Renamed the ${what} "${key}" to "${meant}".`, { on, op: 'rename', key, to: meant });
    } else {
      report(`Removed the ${what} "${key}", which nothing reads.`, { on, op: 'remove', key });
    }

    Reflect.deleteProperty(record, key);
  }
};

/** A flag written as the words `'true'`/`'false'`, stored as the boolean it is read as. */
const asFlag = (value: unknown): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined;

const stepSpec = (
  catalogs: LintCatalogs,
  step: ElementInteraction
): { strictParams?: boolean; params?: ParamSpec } | undefined => {
  const vocabulary = catalogs.vocabulary;
  const table =
    step.type === 'globalCallback'
      ? vocabulary?.globalCallbacks
      : step.type === 'utility'
        ? vocabulary?.utilities
        : step.type === 'callback'
          ? vocabulary?.sharedCallbacks
          : undefined;

  return table && Object.hasOwn(table, step.action) ? table[step.action] : undefined;
};

/**
 * The fixes, by the lint code each settles. Every one is a single reading of what was written — no fix guesses at
 * content: a link to a URL opens the URL, a callback runs on the module that registered it, a key a step does not take
 * is the typo it is closest to or goes. What has more than one reading (a colour's dark value, a template's missing
 * source) is left to whoever wrote it.
 */
const FIXERS: Record<string, Fixer> = {
  'page-target-url': (element, _ctx, report) => {
    const { href, mode } = element.attributes;
    if (element.definition.type === 'link' && (mode ?? 'page') === 'page' && isUrlTarget(href)) {
      element.attributes.mode = 'external';
      report(`The link to "${href}" now opens it as an external URL.`, {
        on: 'attribute',
        op: 'set',
        key: 'mode',
        value: 'external'
      });
    }

    for (const step of stepsOf(element)) {
      if (step.action === 'navigate' && step.params.urlType === 'page' && isUrlTarget(step.params.url)) {
        step.params.urlType = 'external';
        report(`Step "${step.id}" now navigates to "${step.params.url}" as an external URL.`, {
          on: { step: step.id },
          op: 'set',
          key: 'urlType',
          value: 'external'
        });
      }
    }
  },

  'unknown-attribute': (element, ctx, report) => {
    // The names the linter holds the element to: its type's, and an instance's props and slot besides.
    const names = ctx.attributeNamesFor(element);
    if (!isRoot(element) && names) {
      settleUnknownKeys(element.attributes, names, 'attribute', 'attribute', report, ctx.defaultsFor(element));
    }
  },

  'attribute-kind': (element, ctx, report) => {
    const defaults = ctx.catalogs.defaultAttributes?.[element.definition.type] ?? {};
    for (const [name, value] of Object.entries(element.attributes)) {
      const flag = asFlag(value);
      if (typeof defaults[name] === 'boolean' && flag !== undefined) {
        element.attributes[name] = flag;
        report(`\`${name}\` is now the boolean ${String(flag)}, not the text "${String(value)}".`, {
          on: 'attribute',
          op: 'set',
          key: name,
          value: flag
        });
      }
    }
  },

  'step-params': (element, ctx, report) => {
    for (const step of stepsOf(element)) {
      const spec = stepSpec(ctx.catalogs, step);
      if (!spec?.params) {
        continue;
      }

      const params = spec.params;
      if (spec.strictParams) {
        settleUnknownKeys(step.params, Object.keys(params), `param of step "${step.id}"`, { step: step.id }, report);
      }

      for (const [key, value] of Object.entries(step.params)) {
        const flag = asFlag(value);
        if (Object.hasOwn(params, key) && params[key].type === 'boolean' && flag !== undefined) {
          step.params[key] = flag;
          report(`Step "${step.id}": \`${key}\` is now the boolean ${String(flag)}.`, {
            on: { step: step.id },
            op: 'set',
            key,
            value: flag
          });
        }
      }
    }
  },

  'global-callback-module': (element, ctx, report) => {
    for (const step of stepsOf(element)) {
      const declared =
        step.type === 'globalCallback' && ctx.catalogs.vocabulary
          ? ctx.catalogs.vocabulary.globalCallbacks[step.action]
          : undefined;
      if (declared && step.elementId !== declared.source) {
        step.elementId = declared.source;
        report(`Step "${step.id}" now runs "${step.action}" on "${declared.source}", the module that registers it.`, {
          on: { step: step.id },
          op: 'set',
          key: 'on',
          value: declared.source
        });
      }
    }
  },

  'utility-module': (element, ctx, report) => {
    for (const step of stepsOf(element)) {
      const known = ctx.catalogs.vocabulary ? Object.hasOwn(ctx.catalogs.vocabulary.utilities, step.action) : false;
      if (step.type === 'utility' && known && step.elementId !== null) {
        step.elementId = null;
        report(`Step "${step.id}" runs the utility "${step.action}" on no element: a utility takes none.`, {
          on: { step: step.id },
          op: 'remove',
          key: 'on'
        });
      }
    }
  },

  'visibility-as-attribute': (element, _ctx, report) => {
    const bindings = element.definition.bindings;
    const moved = bindings?.attributes?.filter(binding => binding.to === 'visibility') ?? [];
    if (!bindings || moved.length === 0) {
      return;
    }

    bindings.attributes = bindings.attributes?.filter(binding => binding.to !== 'visibility');
    bindings.initialState = [...(bindings.initialState ?? []), ...moved];
    report('The visibility binding now sets the visibility, rather than an attribute nothing reads.');
  },

  'binding-target-unknown': (element, ctx, report) => {
    const names = ctx.attributeNamesFor(element);
    const bindings = element.definition.bindings;
    if (!names || !bindings?.attributes) {
      return;
    }

    const reads = (binding: ElementBinding) =>
      binding.to === 'visibility' || binding.to === 'className' || names.includes(binding.to);
    for (const binding of bindings.attributes.filter(candidate => !reads(candidate))) {
      report(`Removed the binding onto "${binding.to}", which a "${element.definition.type}" never reads.`, {
        on: 'binding',
        op: 'remove',
        key: binding.to
      });
    }

    bindings.attributes = bindings.attributes.filter(reads);
  },

  'unknown-transformer': (element, ctx, report) => {
    const catalog = ctx.catalogs.transformers;
    if (!catalog) {
      return;
    }

    for (const binding of Object.values(element.definition.bindings ?? {}).flat()) {
      for (const transformer of binding.transformers ?? []) {
        const meant = Object.hasOwn(catalog, transformer.action)
          ? undefined
          : closest(transformer.action, Object.keys(catalog));
        if (meant !== undefined) {
          report(`The binding of "${binding.to}" now runs "${meant}" (was "${transformer.action}").`, {
            on: 'binding',
            op: 'replace',
            key: transformer.action,
            to: meant
          });
          transformer.action = meant;
        }
      }
    }
  },

  'list-items-ignored': (element, _ctx, report) => {
    const { attributes } = element;
    const bound = Object.values(element.definition.bindings ?? {})
      .flat()
      .some(binding => binding.to === 'items');
    const written = Array.isArray(attributes.items) && attributes.items.length > 0;
    if (element.definition.type === 'list' && attributes.source !== 'controlled' && (bound || written)) {
      attributes.source = 'controlled';
      report('The list now reads its items (`source: controlled`), one row per item.', {
        on: 'attribute',
        op: 'set',
        key: 'source',
        value: 'controlled'
      });
    }
  },

  'list-row-not-li': (element, ctx, report) => {
    const { parentId } = element.definition;
    const list = parentId ? ctx.element(parentId) : undefined;
    if (list?.definition.type === 'list' && list.attributes.source === 'controlled' && isPlainContainer(element)) {
      element.attributes.subType = 'li';
      report('The row is now an `<li>` (`subType: li`), an item of the list it renders in.', {
        on: 'attribute',
        op: 'set',
        key: 'subType',
        value: 'li'
      });
    }
  },

  'overlay-starts-open': (element, _ctx, report) => {
    const { type, bindings } = element.definition;
    const visibilityBound = (bindings?.initialState ?? []).some(binding => binding.to === 'visibility');
    if (
      (type === 'modalContainer' || type === 'dialogContainer') &&
      element.definition.initialState?.visibility !== false &&
      !visibilityBound
    ) {
      element.definition.initialState = { ...element.definition.initialState, visibility: false };
      report(`The ${type} now starts closed, to be opened from a flow.`, {
        on: 'field',
        op: 'set',
        key: 'visible',
        value: false
      });
    }
  },

  'state-key-has-runtime-prefix': (element, _ctx, report) => {
    for (const step of stepsOf(element)) {
      if (step.type !== 'globalCallback' || step.elementId !== 'state') {
        continue;
      }

      for (const param of STATE_PATH_PARAMS[step.action] ?? []) {
        const value = step.params[param];
        if (typeof value === 'string' && /^(?:runtime\.)?state\./.test(value)) {
          const next = value.replace(/^(?:runtime\.)?state\./, '');
          step.params[param] = next;
          report(`Step "${step.id}": \`${param}\` is now "${next}" (was "${value}").`, {
            on: { step: step.id },
            op: 'set',
            key: param,
            value: next
          });
        }
      }
    }
  }
};

/** The lint codes `fixSpace` knows how to settle: what the builder offers to fix, and what the server will fix. */
export const FIXABLE_CODES: ReadonlySet<string> = new Set(Object.keys(FIXERS));

/**
 * The space with every issue that has one reading fixed, and a line for each change.
 *
 * Works on a copy: the documents handed in are untouched, and with nothing to fix the schema handed in is answered. `codes` narrows it to some of the fixable codes, and
 * `elements` to some of the elements — what an editor fixes in passing on the ones it is about to change, leaving the
 * rest of the space as it found it. What it cannot fix — anything that needs a decision only the author can make — is
 * left as it was, for the linter to keep reporting.
 */
export const fixSpace = (
  { schema, style }: { schema: Schema; style: Style },
  catalogs: LintCatalogs = {},
  codes: Iterable<string> = FIXABLE_CODES,
  elements?: Iterable<string>
): FixResult => {
  const wanted = new Set(codes);
  const only = elements ? new Set(elements) : undefined;
  const applied: AppliedFix[] = [];
  // A fixer changes the element it is handed and nothing else, so each is fixed on a copy of its own, and a tree is
  // copied only around the ones that changed — a fix on one element of thousands no longer clones them all. Every
  // tree: an element inside a component is fixed the way one on a page is.
  const fixTree = (flat: Schema['flat'], ctx: LintContext): Schema['flat'] => {
    const changed: Schema['flat'] = {};
    for (const element of Object.values(flat)) {
      if (only && !only.has(element.id)) {
        continue;
      }

      const draft = structuredClone(element);
      const before = applied.length;
      for (const [code, fix] of Object.entries(FIXERS)) {
        if (wanted.has(code)) {
          fix(draft, ctx, (message, change) =>
            applied.push({ code, elementId: element.id, message, ...(change ? { change } : {}) })
          );
        }
      }

      if (applied.length > before) {
        changed[element.id] = draft;
      }
    }

    return Object.keys(changed).length > 0 ? { ...flat, ...changed } : flat;
  };

  const flat = fixTree(schema.flat, new LintContext(schema, style, catalogs));
  const components = Object.fromEntries(
    Object.entries(schema.components).map(([id, component]) => {
      const fixed = fixTree(component.flat, new LintContext(schema, style, catalogs, component));

      return [id, fixed === component.flat ? component : { ...component, flat: fixed }];
    })
  );
  const next = applied.length > 0 ? { ...schema, flat, components } : schema;

  return { schema: next, style, applied };
};
