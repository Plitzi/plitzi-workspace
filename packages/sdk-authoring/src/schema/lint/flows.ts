import { KEY_TRIGGER, parseKeys } from '@plitzi/sdk-shared/helpers/keys';
import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { WHILE_RUNNING_MODES } from '@plitzi/sdk-shared/types/SchemaTypes';

import { STEP_TYPES, paramIssue } from '../guard';
import { didYouMean } from '../suggest';
import { checkPageTarget } from './pages';
import { checkTemplate } from './templates';

import type { LintContext } from './context';
import type { Element, ElementInteraction } from '@plitzi/sdk-shared';

const STEP_TYPE_NAMES = new Set<string>(STEP_TYPES);

/** A step's params that name a path under `runtime.state`, by action. */
export const STATE_PATH_PARAMS: Record<string, readonly string[]> = {
  setState: ['key'],
  toggleState: ['key'],
  appendState: ['key'],
  removeState: ['key'],
  toggleInState: ['key'],
  clearState: ['key'],
  moveState: ['from', 'to']
};

/** The element callbacks that write one field of the element they run on, named by `category` and `key`. */
const FIELD_CALLBACKS = new Set(['setState', 'toggleState']);

/** Every string inside a value, however deep — a step's params nest objects and lists of them. */
const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }

  return typeof value === 'object' && value !== null ? Object.values(value).flatMap(stringsIn) : [];
};

/**
 * The flows an element declares, each in the order it runs.
 *
 * A flow is a linked list inside one record — every node names the one before and after it, and carries the id of
 * the first as its `flowId`. A chain that does not hold together is the structural validator's to report; here it is
 * read as far as it goes.
 */
const flowsOf = (element: Element): ElementInteraction[][] => {
  const nodes = Object.values(element.definition.interactions ?? {});
  const byId = new Map(nodes.map(node => [node.id, node]));

  return [...new Set(nodes.map(node => node.flowId))].map(flowId => {
    const ordered: ElementInteraction[] = [];
    const seen = new Set<string>();
    for (let node = byId.get(flowId); node && !seen.has(node.id); node = byId.get(node.afterNode)) {
      seen.add(node.id);
      ordered.push(node);
    }

    return ordered;
  });
};

/**
 * A global callback's module, a utility's absence of one, the params either takes, and the warnings for a catalog
 * that does not know the action — a plugin may register one this process cannot see.
 */
const checkAction = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  const vocabulary = ctx.catalogs.vocabulary;
  if (!vocabulary) {
    return;
  }

  const at = `${where}: step "${node.action}"`;
  if (node.type === 'globalCallback') {
    const declared = Object.hasOwn(vocabulary.globalCallbacks, node.action)
      ? vocabulary.globalCallbacks[node.action]
      : undefined;
    if (!declared) {
      ctx.warn(
        'unknown-global-callback',
        `${where} runs the global callback "${node.action}", which no built-in source declares. It resolves at run time only if something registers it — a plugin, or a module this space brings itself.`,
        hostId,
        { action: node.action, on: node.elementId }
      );

      return;
    }

    // Registered under its source MODULE, never under the element hosting the flow; a step with no module at all is
    // stored as `elementId: null`, which resolves to nothing.
    if (node.elementId !== declared.source) {
      ctx.error(
        'global-callback-module',
        `${where} runs the global callback "${node.action}" on ${node.elementId === null ? 'no module' : `"${node.elementId}"`}, but it is registered on "${declared.source}". A global callback names the module that registered it, never the element the flow sits on — the step builders fill this in.`,
        hostId
      );
    }

    const issue = paramIssue(node.params, declared, at);
    if (issue) {
      ctx.error('step-params', issue, hostId);
    }
  }

  if (node.type === 'utility') {
    if (!Object.hasOwn(vocabulary.utilities, node.action)) {
      ctx.warn(
        'unknown-utility',
        `${where} runs the utility "${node.action}", which is not one of the built-in utilities.`,
        hostId,
        { action: node.action }
      );

      return;
    }

    // The one kind of step where naming a target is the mistake: the runtime resolves a utility by action alone.
    if (node.elementId !== null) {
      ctx.error(
        'utility-module',
        `${where} runs the utility "${node.action}" on "${node.elementId}". A utility is resolved by its action alone and takes no module — drop the \`on\`.`,
        hostId
      );
    }

    const issue = paramIssue(node.params, vocabulary.utilities[node.action], at);
    if (issue) {
      ctx.error('step-params', issue, hostId);
    }
  }
};

/**
 * A trigger its element never fires is a flow that is saved, looks right beside the element, and never runs. The
 * error names the types that DO fire it, because the usual mistake is one element off: `onSubmit` on the submit
 * button, not the form. A plugin's type fires its own, and a trigger aimed at another element is that one's.
 */
/** A shortcut that cannot fire: a key nobody can press, a combo of two keys, or nothing at all. */
const checkTriggerKeys = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  if (node.action !== KEY_TRIGGER) {
    return;
  }

  const { keys } = node.params;
  const problems = typeof keys === 'string' && keys.trim() ? parseKeys(keys).problems : ['no keys at all'];
  if (!problems.length) {
    return;
  }

  ctx.error(
    'trigger-keys',
    `${where} starts a flow on a keyboard shortcut that cannot fire: ${problems.join('; ')}. Write one or several, with commas: \`onKey('f')\`, \`onKey('shift+f')\`, \`onKey('mod+k, escape')\`.`,
    hostId
  );
};

/**
 * `whileRunning` is a trigger's: it says what firing the trigger again does. On any other step it means nothing and
 * runs nothing — and a value outside the three is a flow that does something nobody chose.
 */
const checkWhileRunning = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  const { whileRunning } = node;
  if (whileRunning === undefined) {
    return;
  }

  if (node.type !== 'trigger') {
    ctx.error(
      'while-running',
      `${where}: step "${node.id}" (${node.action}) sets whileRunning, which only a flow's trigger reads. Put it on the first step: \`[whileRunning('${whileRunning}', onClick()), …]\`.`,
      hostId
    );

    return;
  }

  if (!WHILE_RUNNING_MODES.includes(whileRunning)) {
    ctx.error(
      'while-running',
      `${where}: the trigger "${node.action}" sets whileRunning "${whileRunning}". It is one of ${WHILE_RUNNING_MODES.map(mode => `'${mode}'`).join(', ')}.`,
      hostId
    );
  }
};

const checkTrigger = (ctx: LintContext, node: ElementInteraction, where: string, host: Element): void => {
  checkTriggerKeys(ctx, node, where, host.id);
  const triggers = ctx.catalogs.vocabulary?.triggers;
  const type = ctx.catalogType(host);
  if (
    !triggers ||
    type === undefined ||
    (node.elementId !== null && node.elementId !== host.id) ||
    !Object.hasOwn(triggers, type)
  ) {
    return;
  }

  const fired = triggers[type];
  if (fired.includes(node.action)) {
    return;
  }

  const firedBy = Object.keys(triggers).filter(candidate => triggers[candidate].includes(node.action));
  const hint = firedBy.length
    ? ` It is fired by ${firedBy.map(candidate => `"${candidate}"`).join(', ')}: declare the flow on that element.`
    : ` No built-in element fires it${didYouMean(node.action, fired) || '.'}`;
  ctx.error(
    'trigger-never-fired',
    `${where} starts a flow on "${node.action}", which a "${type}" never fires.${hint}`,
    host.id
  );
};

/**
 * An element callback runs on the element it names, and a built-in type says which ones it answers to — `openModal`
 * sent to a plain container is a button that does nothing. A missing target is the structural validator's; a plugin's
 * type registers callbacks nobody here can see.
 */
const checkCallbackTarget = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  const callbacks = ctx.catalogs.vocabulary?.callbacks;
  const target = node.elementId ?? hostId;
  const targetElement = ctx.element(target);
  const type = targetElement && ctx.catalogType(targetElement);
  if (!callbacks || type === undefined || !Object.hasOwn(callbacks, type)) {
    return;
  }

  const answered = callbacks[type];
  if (answered.includes(node.action)) {
    return;
  }

  const answeredBy = Object.keys(callbacks).filter(candidate => callbacks[candidate].includes(node.action));
  const hint = answeredBy.length
    ? ` It is a callback of ${answeredBy.map(candidate => `"${candidate}"`).join(', ')}: aim it at one of those.`
    : ` No built-in element answers to it${didYouMean(node.action, answered) || '.'}`;
  ctx.error(
    'callback-not-answered',
    `${where} sends "${node.action}" to "${target}", a "${type}" that never answers to it.${hint}`,
    hostId
  );
};

/**
 * The field `setState`/`toggleState` write, against what the element they run on has: an attribute it reads, or its
 * visibility or one of its style selectors. A key it does not have is written and never read — the click works, and
 * nothing changes. A template key is only known when the step runs, and a plugin's type says nothing here.
 */
const checkCallbackKey = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  const { key, category } = node.params;
  const target = node.elementId ?? hostId;
  const targetElement = ctx.element(target);
  const type = targetElement && ctx.catalogType(targetElement);
  const names = type === undefined ? null : ctx.attributeNames(type);
  if (typeof key !== 'string' || key === '' || hasTemplateSyntax(key) || type === undefined || !names) {
    return;
  }

  const at = `${where}: step "${node.action}" sets`;
  if (category === 'state') {
    const selectors = ['base', ...(ctx.catalogs.slotNames?.[type] ?? [])].map(selector => `styleSelectors.${selector}`);
    const keys = ['visibility', ...selectors];
    if (!keys.includes(key)) {
      ctx.error(
        'callback-key-unknown',
        `${at} the state "${key}" on "${target}", which a "${type}" does not have${didYouMean(key, keys) || '.'} Its state is ${keys.join(', ')}.`,
        hostId
      );
    }

    return;
  }

  // `className` is never written as an attribute, but every element hands it to its root.
  if (key !== 'className' && !names.includes(key)) {
    ctx.error(
      'callback-key-unknown',
      `${at} "${key}" on "${target}", which a "${type}" never reads — the step runs and nothing changes${didYouMean(key, names) || '.'} It reads ${names.join(', ')}.`,
      hostId
    );
  }
};

/**
 * The callbacks every element answers to take params the runtime reads as declared; a type's own callbacks describe
 * theirs for the builder's controls, so only these are held to them.
 */
const checkSharedCallback = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  const shared = ctx.catalogs.vocabulary?.sharedCallbacks;
  if (!shared || !Object.hasOwn(shared, node.action)) {
    return;
  }

  const issue = paramIssue(node.params, shared[node.action], `${where}: step "${node.action}"`);
  if (issue) {
    ctx.error('step-params', issue, hostId);

    return;
  }

  if (FIELD_CALLBACKS.has(node.action)) {
    checkCallbackKey(ctx, node, where, hostId);
  }
};

/**
 * A step's params are templates the runtime resolves against the flow scope as written, so a source in them is named
 * in full: `{{ list_jobRows.item.id }}`, not `{{ jobRows.item.id }}` — the short form renders empty and the button
 * posts a blank id. A root that is also a step of the same flow is that step's result, and is left alone.
 */
const checkStepTemplates = (
  ctx: LintContext,
  node: ElementInteraction,
  stepIds: ReadonlySet<string>,
  where: string,
  hostId: string
): void => {
  for (const template of stringsIn(node.params)) {
    checkTemplate(ctx, template, `${where}: step "${node.id}"`, { kind: 'step' }, new Set(), hostId);
    for (const [, expression = ''] of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      for (const [, , root = ''] of expression.matchAll(/(^|[^\w.$-])([A-Za-z_][\w-]*)\.[A-Za-z_]/g)) {
        const prefix = ctx.sources.get(root);
        if (prefix && !stepIds.has(root)) {
          ctx.error(
            'template-short-source',
            `${where}: step "${node.id}" reads "{{ ${expression.trim()} }}". Inside a flow a source is named in full — write "${prefix}_${root}" where it says "${root}". (A binding completes the prefix; a flow's templates are read as written.)`,
            hostId
          );
        }
      }
    }
  }
};

/**
 * State callbacks already write below `runtime.state`, so `key: 'state.genre'` writes `runtime.state.state.genre` — a
 * warning rather than a refusal, because a nested `state` object is possible, just almost never meant.
 */
const warnStatePaths = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  if (node.type !== 'globalCallback' || node.elementId !== 'state') {
    return;
  }

  for (const param of STATE_PATH_PARAMS[node.action] ?? []) {
    const value = node.params[param];
    if (typeof value !== 'string' || !/^(?:runtime\.)?state\./.test(value)) {
      continue;
    }

    const bare = value.replace(/^(?:runtime\.)?state\./, '');
    ctx.warn(
      'state-key-has-runtime-prefix',
      `${where} passes "${value}" as ${param} to state.${node.action}. State callbacks already write below \`runtime.state\`; use "${bare}" instead, unless you intentionally need \`runtime.state.${value}\`.`,
      hostId,
      { action: node.action, param, value, suggested: bare }
    );
  }
};

/** Every field a condition reads, in its nested groups as much as at its top level. */
const conditionFields = (group: unknown): string[] => {
  if (typeof group !== 'object' || group === null) {
    return [];
  }

  const field = 'field' in group && typeof group.field === 'string' ? [group.field] : [];
  const rules = 'rules' in group && Array.isArray(group.rules) ? group.rules.flatMap(conditionFields) : [];

  return [...field, ...rules];
};

/** Every rule of a condition, in its nested groups as much as at its top level. */
const conditionRules = (group: unknown): { field: string; operator: unknown; value: unknown }[] => {
  if (typeof group !== 'object' || group === null) {
    return [];
  }

  const rule =
    'field' in group && typeof group.field === 'string'
      ? [
          {
            field: group.field,
            operator: 'operator' in group ? group.operator : undefined,
            value: 'value' in group ? group.value : undefined
          }
        ]
      : [];
  const rules = 'rules' in group && Array.isArray(group.rules) ? group.rules.flatMap(conditionRules) : [];

  return [...rule, ...rules];
};

/** A form's submitted field, as a step reads it: `sent.values.code`. */
const FORM_VALUE = /\.values\.[^.]+$/;

/**
 * A submitted field compared with `""`. A form sends what was typed, and a field nobody typed in is not in `values` at
 * all — so `= ""` never holds for it and `!= ""` always does: the step that should catch an empty field lets it through.
 */
const warnBlankFormValue = (ctx: LintContext, node: ElementInteraction, where: string, hostId: string): void => {
  for (const { field, operator, value } of conditionRules(node.when)) {
    if (!FORM_VALUE.test(field) || (operator !== '=' && operator !== '!=') || (value !== '' && value != null)) {
      continue;
    }

    const instead = operator === '=' ? 'empty' : 'notEmpty';
    ctx.warn(
      'form-value-compared-to-blank',
      `${where}: step "${node.id}" asks whether \`${field}\` ${operator} "". A form sends only what was typed — a field nobody typed in is not in \`values\` at all — so this ${operator === '=' ? 'never holds' : 'always holds'} for an empty field. Ask \`{ field: '${field}', operator: '${instead}' }\`, which takes a missing value and "" alike.`,
      hostId,
      { field, operator, suggested: instead }
    );
  }
};

/**
 * The toggle written in branches: two or more `setState` steps of one key, each only when that key holds some value.
 *
 * Every step reads the state as it is when it runs, so the second branch sees what the first just wrote and writes
 * it back — the flow can turn the value on, never off. `toggleState` is the same thing in one step, with nothing to
 * order.
 */
const warnToggleInBranches = (ctx: LintContext, flow: ElementInteraction[], where: string, hostId: string): void => {
  const guarded = new Map<string, number>();
  for (const node of flow) {
    const { key } = node.params;
    if (node.type !== 'globalCallback' || node.elementId !== 'state' || node.action !== 'setState') {
      continue;
    }

    if (typeof key === 'string' && conditionFields(node.when).includes(`state.${key}`)) {
      guarded.set(key, (guarded.get(key) ?? 0) + 1);
    }
  }

  for (const [key, steps] of guarded) {
    if (steps < 2) {
      continue;
    }

    ctx.warn(
      'state-toggled-in-branches',
      `${where} sets "${key}" in ${steps} steps, each only when \`state.${key}\` holds some value. Every step reads the state as it is when it runs, so the second sees what the first just wrote and writes it back — the value can go on and never off. Flip it in one step: \`toggleState({ key: '${key}' })\`. A key never set flips to true, so if what it controls shows while it is unset, name the key for hiding it (\`${key}Hidden\`).`,
      hostId,
      { key }
    );
  }
};

/** The callbacks that show an overlay, by the type that answers them; closing one is not a way to see it. */
const OPENERS: Readonly<Record<string, string>> = { modalContainer: 'openModal', dialogContainer: 'openDialog' };
const CLOSERS = new Set(['closeModal', 'closeDialog']);

/**
 * An overlay that starts hidden and that no step anywhere shows: everything inside it is authored and never seen.
 * Any step aimed at it other than a close counts — a `setState` of its visibility shows it as surely as `openModal`.
 */
const warnOverlaysNeverOpened = (ctx: LintContext): void => {
  const aimedAt = new Set(
    Object.values(ctx.flat).flatMap(host =>
      Object.values(host.definition.interactions ?? {})
        .filter(node => node.type === 'callback' && !CLOSERS.has(node.action) && typeof node.elementId === 'string')
        .map(node => node.elementId ?? '')
    )
  );
  for (const element of Object.values(ctx.flat)) {
    const opener = OPENERS[element.definition.type];
    if (!opener || aimedAt.has(element.id) || element.definition.initialState?.visibility !== false) {
      continue;
    }

    const bindings = Object.values(element.definition.bindings ?? {}).flat();
    if (bindings.some(binding => binding.to === 'visibility')) {
      continue;
    }

    ctx.warn(
      'overlay-never-opened',
      `${ctx.describe(element.id)} starts hidden and no step anywhere opens it, so what it holds is never seen. Open it from a flow: \`flows: [[onClick(), ${opener}('${element.id}')]]\`.`,
      element.id,
      { opener }
    );
  }
};

/** Every flow of every element, page and layout. */
export const lintFlows = (ctx: LintContext): void => {
  for (const host of Object.values(ctx.flat)) {
    const where = ctx.describe(host.id);
    for (const flow of flowsOf(host)) {
      const [head] = flow;
      if (head.type !== 'trigger') {
        ctx.error(
          'flow-without-trigger',
          `${where} has a flow that does not start with its trigger. A flow is a list whose first step says WHEN it runs: \`[onClick(), setState({ … })]\`.`,
          host.id
        );
      }

      warnToggleInBranches(ctx, flow, where, host.id);
      const stepIds = new Set(flow.map(node => node.id));
      for (const node of flow) {
        if (!STEP_TYPE_NAMES.has(node.type)) {
          ctx.error(
            'step-type',
            `${where}: step "${node.id}" has the type "${node.type}". It is one of ${STEP_TYPES.map(item => `'${item}'`).join(', ')}.`,
            host.id
          );
          continue;
        }

        const { urlType, url } = node.params;
        if (node.action === 'navigate' && urlType === 'page' && typeof url === 'string') {
          checkPageTarget(ctx, url, `${where}: step "navigate"`, 'urlType', host.id);
        }

        warnStatePaths(ctx, node, where, host.id);
        warnBlankFormValue(ctx, node, where, host.id);
        checkWhileRunning(ctx, node, where, host.id);
        if (node.type === 'trigger') {
          checkTrigger(ctx, node, where, host);
          continue;
        }

        checkStepTemplates(ctx, node, stepIds, where, host.id);
        checkAction(ctx, node, where, host.id);
        if (node.type === 'callback') {
          checkCallbackTarget(ctx, node, where, host.id);
          checkSharedCallback(ctx, node, where, host.id);
        }
      }
    }
  }

  warnOverlaysNeverOpened(ctx);
};
