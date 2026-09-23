import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { closest } from '../suggest';
import { STATE_PATH_PARAMS } from './flows';

import type { LintCatalogs } from './context';
import type { Element, ElementBinding, ElementInteraction, Schema, Style } from '@plitzi/sdk-shared';
import type { ParamSpec } from '@plitzi/sdk-shared/authoring/paramSpec';

/** One change a fix made, said the way the problems list says the issue it settles. */
export interface AppliedFix {
  code: string;
  elementId: string | null;
  message: string;
}

export interface FixResult {
  schema: Schema;
  style: Style;
  applied: AppliedFix[];
}

type Report = (message: string) => void;
type Fixer = (element: Element, catalogs: LintCatalogs, report: Report) => void;

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
const settleUnknownKeys = (record: Record<string, unknown>, known: readonly string[], what: string, report: Report) => {
  for (const key of Object.keys(record)) {
    if (known.includes(key)) {
      continue;
    }

    const meant = closest(key, known);
    if (meant !== undefined && record[meant] === undefined) {
      record[meant] = record[key];
      report(`Renamed the ${what} "${key}" to "${meant}".`);
    } else {
      report(`Removed the ${what} "${key}", which nothing reads.`);
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
  'page-target-url': (element, _catalogs, report) => {
    const { href, mode } = element.attributes;
    if (element.definition.type === 'link' && (mode ?? 'page') === 'page' && isUrlTarget(href)) {
      element.attributes.mode = 'external';
      report(`The link to "${href}" now opens it as an external URL.`);
    }

    for (const step of stepsOf(element)) {
      if (step.action === 'navigate' && step.params.urlType === 'page' && isUrlTarget(step.params.url)) {
        step.params.urlType = 'external';
        report(`Step "${step.id}" now navigates to "${step.params.url}" as an external URL.`);
      }
    }
  },

  'unknown-attribute': (element, catalogs, report) => {
    const names = catalogs.attributeNames?.[element.definition.type];
    if (!isRoot(element) && names) {
      settleUnknownKeys(element.attributes, names, 'attribute', report);
    }
  },

  'attribute-kind': (element, catalogs, report) => {
    const defaults = catalogs.defaultAttributes?.[element.definition.type] ?? {};
    for (const [name, value] of Object.entries(element.attributes)) {
      const flag = asFlag(value);
      if (typeof defaults[name] === 'boolean' && flag !== undefined) {
        element.attributes[name] = flag;
        report(`\`${name}\` is now the boolean ${String(flag)}, not the text "${String(value)}".`);
      }
    }
  },

  'step-params': (element, catalogs, report) => {
    for (const step of stepsOf(element)) {
      const spec = stepSpec(catalogs, step);
      if (!spec?.params) {
        continue;
      }

      const params = spec.params;
      if (spec.strictParams) {
        settleUnknownKeys(step.params, Object.keys(params), `param of step "${step.id}"`, report);
      }

      for (const [key, value] of Object.entries(step.params)) {
        const flag = asFlag(value);
        if (Object.hasOwn(params, key) && params[key].type === 'boolean' && flag !== undefined) {
          step.params[key] = flag;
          report(`Step "${step.id}": \`${key}\` is now the boolean ${String(flag)}.`);
        }
      }
    }
  },

  'global-callback-module': (element, catalogs, report) => {
    for (const step of stepsOf(element)) {
      const declared =
        step.type === 'globalCallback' && catalogs.vocabulary
          ? catalogs.vocabulary.globalCallbacks[step.action]
          : undefined;
      if (declared && step.elementId !== declared.source) {
        step.elementId = declared.source;
        report(`Step "${step.id}" now runs "${step.action}" on "${declared.source}", the module that registers it.`);
      }
    }
  },

  'utility-module': (element, catalogs, report) => {
    for (const step of stepsOf(element)) {
      const known = catalogs.vocabulary ? Object.hasOwn(catalogs.vocabulary.utilities, step.action) : false;
      if (step.type === 'utility' && known && step.elementId !== null) {
        step.elementId = null;
        report(`Step "${step.id}" runs the utility "${step.action}" on no element: a utility takes none.`);
      }
    }
  },

  'visibility-as-attribute': (element, _catalogs, report) => {
    const bindings = element.definition.bindings;
    const moved = bindings?.attributes?.filter(binding => binding.to === 'visibility') ?? [];
    if (!bindings || moved.length === 0) {
      return;
    }

    bindings.attributes = bindings.attributes?.filter(binding => binding.to !== 'visibility');
    bindings.initialState = [...(bindings.initialState ?? []), ...moved];
    report('The visibility binding now sets the visibility, rather than an attribute nothing reads.');
  },

  'binding-target-unknown': (element, catalogs, report) => {
    const names = catalogs.attributeNames?.[element.definition.type];
    const bindings = element.definition.bindings;
    if (!names || !bindings?.attributes) {
      return;
    }

    const reads = (binding: ElementBinding) =>
      binding.to === 'visibility' || binding.to === 'className' || names.includes(binding.to);
    for (const binding of bindings.attributes.filter(candidate => !reads(candidate))) {
      report(`Removed the binding onto "${binding.to}", which a "${element.definition.type}" never reads.`);
    }

    bindings.attributes = bindings.attributes.filter(reads);
  },

  'unknown-transformer': (element, catalogs, report) => {
    const catalog = catalogs.transformers;
    if (!catalog) {
      return;
    }

    for (const binding of Object.values(element.definition.bindings ?? {}).flat()) {
      for (const transformer of binding.transformers ?? []) {
        const meant = Object.hasOwn(catalog, transformer.action)
          ? undefined
          : closest(transformer.action, Object.keys(catalog));
        if (meant !== undefined) {
          report(`The binding of "${binding.to}" now runs "${meant}" (was "${transformer.action}").`);
          transformer.action = meant;
        }
      }
    }
  },

  'overlay-starts-open': (element, _catalogs, report) => {
    const { type, bindings } = element.definition;
    const visibilityBound = (bindings?.initialState ?? []).some(binding => binding.to === 'visibility');
    if (
      (type === 'modalContainer' || type === 'dialogContainer') &&
      element.definition.initialState?.visibility !== false &&
      !visibilityBound
    ) {
      element.definition.initialState = { ...element.definition.initialState, visibility: false };
      report(`The ${type} now starts closed, to be opened from a flow.`);
    }
  },

  'state-key-has-runtime-prefix': (element, _catalogs, report) => {
    for (const step of stepsOf(element)) {
      if (step.type !== 'globalCallback' || step.elementId !== 'state') {
        continue;
      }

      for (const param of STATE_PATH_PARAMS[step.action] ?? []) {
        const value = step.params[param];
        if (typeof value === 'string' && /^(?:runtime\.)?state\./.test(value)) {
          step.params[param] = value.replace(/^(?:runtime\.)?state\./, '');
          report(`Step "${step.id}": \`${param}\` is now "${String(step.params[param])}" (was "${value}").`);
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
 * Works on a copy: the documents handed in are untouched. `codes` narrows it to some of the fixable codes. What it
 * cannot fix — anything that needs a decision only the author can make — is left as it was, for the linter to keep
 * reporting.
 */
export const fixSpace = (
  { schema, style }: { schema: Schema; style: Style },
  catalogs: LintCatalogs = {},
  codes: Iterable<string> = FIXABLE_CODES
): FixResult => {
  const wanted = new Set(codes);
  const next = structuredClone(schema);
  const applied: AppliedFix[] = [];
  for (const element of Object.values(next.flat)) {
    for (const [code, fix] of Object.entries(FIXERS)) {
      if (wanted.has(code)) {
        fix(element, catalogs, message => applied.push({ code, elementId: element.id, message }));
      }
    }
  }

  return { schema: next, style, applied };
};
