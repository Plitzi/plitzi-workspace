import { STEP_TYPES, paramIssue } from '../guard';
import { didYouMean } from '../suggest';
import { checkPageTarget } from './pages';
import { checkTemplate } from './templates';

import type { LintContext } from './context';
import type { Element, ElementInteraction } from '@plitzi/sdk-shared';

const STEP_TYPE_NAMES = new Set<string>(STEP_TYPES);

/** A step's params that name a path under `runtime.state`, by action. */
const STATE_PATH_PARAMS: Record<string, readonly string[]> = {
  setState: ['key'],
  toggleState: ['key'],
  appendState: ['key'],
  removeState: ['key'],
  toggleInState: ['key'],
  clearState: ['key'],
  moveState: ['from', 'to']
};

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
const checkTrigger = (ctx: LintContext, node: ElementInteraction, where: string, host: Element): void => {
  const triggers = ctx.catalogs.vocabulary?.triggers;
  const type = host.definition.type;
  if (!triggers || (node.elementId !== null && node.elementId !== host.id) || !Object.hasOwn(triggers, type)) {
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
  const type = ctx.element(target)?.definition.type;
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
        if (node.type === 'trigger') {
          checkTrigger(ctx, node, where, host);
          continue;
        }

        checkStepTemplates(ctx, node, stepIds, where, host.id);
        checkAction(ctx, node, where, host.id);
        if (node.type === 'callback') {
          checkCallbackTarget(ctx, node, where, host.id);
        }
      }
    }
  }
};
