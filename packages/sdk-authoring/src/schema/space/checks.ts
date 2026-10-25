import { propNameProblem, isValidElementId } from '@plitzi/sdk-schema';
import { checkVisitorRoles } from '@plitzi/sdk-shared/auth';
import { BUILTIN_PARAM_TYPES } from '@plitzi/sdk-shared/authoring';
import { channelProblems } from '@plitzi/sdk-shared/realtime';
import { spaceIdentity, spaceIdentityProblems } from '@plitzi/sdk-shared/schema';

import { GLOBAL_SOURCES } from '../bindings';
import { AuthoringError, AUTHORING_CODES, isSuggestionCode } from '../codes';
import {
  COMPONENT_SPEC_KEYS,
  ELEMENT_SPEC_KEYS,
  ELEMENT_STYLE_SPEC_KEYS,
  LAYOUT_SPEC_KEYS,
  PAGE_FOLDER_SPEC_KEYS,
  PAGE_SPEC_KEYS,
  SPACE_SPEC_KEYS,
  STEP_SPEC_KEYS,
  assertId,
  assertKnownKeys
} from '../guard';
import { didYouMean } from '../suggest';
import { componentWhere, pageFieldHint } from './values';

import type { SpaceAuthor } from './author';
import type { SourceIndex } from '../bindings';
import type { ElementSpec, StepSpec } from '../types';

/**
 * The flows' own shape, before they are written: a flow that has steps, and steps that are step specs. What the
 * steps MEAN — the module a callback runs on, the params it takes, the trigger that starts it — is read from the
 * written document by `lintSpace`, the gate every space goes through.
 */
export const assertFlowShapes = (flows: StepSpec[][] | undefined, where: string): void => {
  for (const steps of flows ?? []) {
    // An empty flow is written as nothing at all: the declaration would vanish from the document without a word.
    if (steps.length === 0) {
      throw new AuthoringError(
        'flow-empty',
        `${where} has an empty flow. A flow is a list whose first step says WHEN it runs: \`[onClick(), setState({ … })]\`.`
      );
    }

    for (const step of steps) {
      assertKnownKeys(
        step,
        STEP_SPEC_KEYS,
        `${where}: a step`,
        ' Build steps with the step builders — `setState(…)`, `navigate(…)`.'
      );
    }
  }
};

/**
 * Every element that publishes a data source, before anything binds to one — and every name the author wrote.
 *
 * Only elements NAMED by the author publish: a derived name is positional, so a binding naming one would move the
 * moment an element was added above it, which is why nothing is meant to refer to one. Naming the element is how
 * an author says "this is a thing other parts of the space point at".
 */
export const collectSources = (author: SpaceAuthor, spec: ElementSpec, index: SourceIndex = author.sources): void => {
  if (spec.id) {
    author.authorNames.add(spec.id);
  }

  const sourceTypes = author.options.sourceTypes;
  const prefix = sourceTypes?.[spec.type];
  if (prefix && spec.id) {
    // The globals are registered for the whole space under bare names, so an element answering to one makes its
    // own source unreachable AND shadows the global for every binding in the space that meant the other one.
    if (GLOBAL_SOURCES.includes(spec.id)) {
      throw new AuthoringError(
        'id-shadows-global',
        `Element "${spec.type}" is named "${spec.id}", which is one of the global data sources (${GLOBAL_SOURCES.join(', ')}). Give it another name.`
      );
    }

    index.set(spec.id, prefix);
  }

  spec.children?.forEach(child => collectSources(author, child, index));
};

/**
 * The declaration's own shape, before anything is written from it: every field one the spec takes, every page and
 * layout and folder likewise, every value that comes from a list inside it.
 */
export const assertSpaceShape = (author: SpaceAuthor): void => {
  assertKnownKeys(author.spec, SPACE_SPEC_KEYS, 'The space');
  if (!Array.isArray(author.spec.pages)) {
    throw new AuthoringError(
      'no-pages',
      'The space has no `pages` list. Write at least one: `pages: [{ id: "home", name: "Home", slug: "", body: [] }]`.'
    );
  }

  for (const [type, style] of Object.entries(author.spec.elements ?? {})) {
    assertKnownKeys(style, ELEMENT_STYLE_SPEC_KEYS, `\`elements.${type}\``);
  }

  for (const folder of author.spec.pageFolders ?? []) {
    assertKnownKeys(folder, PAGE_FOLDER_SPEC_KEYS, `Page folder "${folder.id}"`);
  }

  for (const layout of author.spec.layouts ?? []) {
    assertKnownKeys(layout, LAYOUT_SPEC_KEYS, `Layout "${layout.id}"`);
    assertId(layout.id, `Layout "${layout.id}"`);
  }

  const componentIds = new Set<string>();
  for (const component of author.spec.components ?? []) {
    const where = componentWhere(component);
    assertKnownKeys(component, COMPONENT_SPEC_KEYS, where);
    // Read as what reached here, not what the type promises: a spec is often assembled by hand or by an agent.
    const id: unknown = component.id;
    if (typeof id !== 'string' || !isValidElementId(id)) {
      throw new AuthoringError(
        'component-id',
        `${where} needs an \`id\` that starts with a letter, then letters, numbers, hyphens and underscores — it is the name an instance places it by: \`component('${String(id)}')\`.`
      );
    }

    if (componentIds.has(component.id)) {
      throw new AuthoringError(
        'component-duplicate',
        `Two components are called "${component.id}". A component's id is the one name it is placed by.`
      );
    }

    componentIds.add(component.id);
    for (const [name, prop] of Object.entries(component.props ?? {})) {
      const problem = propNameProblem(name);
      if (problem) {
        throw new AuthoringError('prop-name', `${where}: ${problem}.`);
      }

      // Read at run time too: a project in JavaScript, or one nobody type-checks, would otherwise declare a prop of
      // a type no editor offers and nothing checks a value against — and never hear of it.
      const types: readonly string[] = BUILTIN_PARAM_TYPES;
      const type: string = prop.type;
      if (!types.includes(type)) {
        throw new AuthoringError(
          'prop-type-unknown',
          `${where} declares the prop "${name}" as \`${type}\`, which is no type${didYouMean(type, [...types]) || '.'} A prop is one of ${types.join(', ')}: words are \`text\`.`
        );
      }
    }
  }

  for (const page of author.spec.pages) {
    const where = `Page "${page.name}"`;
    assertKnownKeys(page, PAGE_SPEC_KEYS, where, pageFieldHint);
    assertId(page.id, where);
    if (typeof page.slug !== 'string') {
      throw new AuthoringError(
        'page-without-slug',
        `${where} has no \`slug\`. The home page's is '' and every other page's is its path: 'about', 'blog/{{slug}}'.`
      );
    }
  }
};

/** An element spec's own fields, before any of them is used. */
export const assertElementShape = (spec: ElementSpec, path: string): void => {
  const where = `The element at ${path}${typeof spec.id === 'string' ? ` ("${spec.id}")` : ''}`;
  assertKnownKeys(
    spec,
    ELEMENT_SPEC_KEYS,
    where,
    ' An attribute goes inside `attributes` — a factory puts it there for you: `button({ content: "Go" })`.'
  );
  if (typeof spec.type !== 'string' || spec.type === '') {
    throw new AuthoringError(
      'element-shape',
      `${where} has no \`type\`. Build elements with their factories — \`text(…)\`, \`container(…)\`.`
    );
  }

  // Read as `unknown`: the type says it is an object, and this is the check for the declarations the type never saw.
  const attributes: unknown = spec.attributes;
  if (
    attributes !== undefined &&
    (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes))
  ) {
    throw new AuthoringError(
      'element-shape',
      `${where}: \`attributes\` is not an object of attribute names and values.`
    );
  }

  if (spec.children !== undefined && !Array.isArray(spec.children)) {
    throw new AuthoringError('element-shape', `${where}: \`children\` is not a list of elements.`);
  }

  assertId(spec.id, where);
};

/**
 * The space's identity — its name, language, icon, share picture and colour — held to what a head reads, as the builder
 * holds it while it is typed (`spaceIdentityProblems`): a favicon written as a bare name is a tab with no icon.
 */
export const assertSpaceIdentity = (author: SpaceAuthor): void => {
  const problems = spaceIdentityProblems(spaceIdentity(author.spec.settings));
  if (problems.length > 0) {
    throw new AuthoringError('space-identity-invalid', `settings: ${problems.join(' ')}`);
  }
};

/** The fields of a robots.txt search engines read; anything else is a line no crawler follows. */
const ROBOTS_TXT_FIELDS = ['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host'];

/**
 * The space's robots.txt, held to what crawlers read: each line a comment, blank, or `Field: value` of a field they
 * know — a line they skip is a rule that silently does nothing.
 */
export const assertRobotsTxt = (author: SpaceAuthor): void => {
  const text = author.spec.settings?.robotsTxt;
  if (text === undefined) {
    return;
  }

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const bare = line.replace(/#.*$/, '').trim();
    if (bare === '') {
      return;
    }

    const field = /^([A-Za-z-]+)\s*:/.exec(bare)?.[1]?.toLowerCase();
    if (field === undefined || !ROBOTS_TXT_FIELDS.includes(field)) {
      throw new AuthoringError(
        'robots-txt-line',
        `settings.robotsTxt line ${String(index + 1)} ("${line.trim()}") is no rule a crawler reads: each line is \`Field: value\` of ${ROBOTS_TXT_FIELDS.join(', ')} — or a comment (#).`
      );
    }
  });
  if (!lines.some(line => /^\s*user-agent\s*:/i.test(line))) {
    throw new AuthoringError(
      'robots-txt-line',
      'settings.robotsTxt names no `User-agent:`: its rules apply to nobody — start it with `User-agent: *`.'
    );
  }
};

/**
 * The space's computed values are written once, under `computed` — the same map in `settings` as well would leave
 * two answers to one question. What they say is `lintSpace`'s to read.
 */
export const assertComputedOnce = (author: SpaceAuthor): void => {
  // Typed out of `settings`, and still refused for a space written without the types.
  if (Object.hasOwn(author.spec.settings ?? {}, 'computed')) {
    throw new AuthoringError(
      'setting-misplaced',
      '`settings.computed` is written through `computed` at the top of the space, not inside `settings`.'
    );
  }
};

/**
 * The channels a space offers, checked where they are written: a pattern a page could never match, or a channel
 * with no access rule, is a channel nobody can use — refused with what to write instead.
 */
export const assertChannels = (author: SpaceAuthor): void => {
  if (Object.hasOwn(author.spec.settings ?? {}, 'channels')) {
    throw new AuthoringError(
      'setting-misplaced',
      '`settings.channels` is written through `channels` at the top of the space, not inside `settings`.'
    );
  }

  for (const [pattern, declaration] of Object.entries(author.spec.channels ?? {})) {
    const [problem] = channelProblems(pattern, declaration);
    if (problem) {
      throw new AuthoringError('channel-declaration', `Channel "${pattern}": ${problem}.`);
    }
  }
};

/**
 * A setting that names `runtime.state` keys — `transientState`, `paintedState` — checked the same way: refused when it
 * could not work — not a list, an empty name, or a dotted one: the runtime compares top-level keys, so `demo.step`
 * would never match anything and the setting would do nothing at all. Answers the keys.
 */
const stateKeyList = (
  author: SpaceAuthor,
  setting: 'transientState' | 'paintedState' | 'keptState',
  example: string[],
  does: string
): string[] => {
  const listed: unknown = author.spec.settings?.[setting];
  if (listed === undefined) {
    return [];
  }

  if (!Array.isArray(listed)) {
    throw new AuthoringError(
      'state-key-list',
      `\`settings.${setting}\` is ${JSON.stringify(listed)}. Write the state keys ${does} as a list: \`${setting}: [${example.map(key => `'${key}'`).join(', ')}]\`.`
    );
  }

  return listed.map((key: unknown) => {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new AuthoringError(
        'state-key-list',
        `\`settings.${setting}\` has ${JSON.stringify(key)}, which is not a state key. Each entry is the \`key\` a \`setState\` step writes, like 'demoStep'.`
      );
    }

    if (key.includes('.')) {
      throw new AuthoringError(
        'state-key-list',
        `\`settings.${setting}\` has "${key}", a dotted path. It names top-level keys of \`runtime.state\` — write "${key.split('.')[0]}" for everything under it.`
      );
    }

    return key;
  });
};

/**
 * The keys a space never keeps. Warned when it cannot DO anything: without `keepState` nothing is kept in the first
 * place.
 */
export const assertTransientState = (author: SpaceAuthor): void => {
  const transient = stateKeyList(author, 'transientState', ['demoStep', 'panelOpen'], 'never to keep');
  if (transient.length > 0 && author.spec.settings?.keepState !== true) {
    author.styleWarnings.push({
      code: 'transient-state-without-keep-state',
      message:
        '`settings.transientState` names keys never to keep, but `settings.keepState` is not on — nothing is kept in the first place, so it does nothing. Turn `keepState` on, or remove `transientState`.',
      details: { keys: transient }
    });
  }
};

/**
 * The only keys a space keeps. Refused beside `transientState`: one names what is kept, the other what is not, and a
 * key in neither would be kept by one and not by the other. Warned without `keepState`, as `transientState` is.
 */
export const assertKeptState = (author: SpaceAuthor): void => {
  const kept = stateKeyList(author, 'keptState', ['dismissedNotice'], 'to keep, and only those');
  if (kept.length > 0 && (author.spec.settings?.transientState ?? []).length > 0) {
    throw new AuthoringError(
      'state-kept-and-transient',
      '`settings.keptState` names the only keys kept, and `settings.transientState` the keys left out — say one of the two: `keptState` when few are kept, `transientState` when few are not.'
    );
  }

  if (kept.length > 0 && author.spec.settings?.keepState !== true) {
    author.styleWarnings.push({
      code: 'kept-state-without-keep-state',
      message:
        '`settings.keptState` names the keys to keep, but `settings.keepState` is not on — nothing is kept, so it does nothing. Turn `keepState` on, or remove `keptState`.',
      details: { keys: kept }
    });
  }
};

/**
 * The kept keys the first paint depends on, which the server renders with (see `paintedState.ts` in sdk-shared).
 *
 * Refused when a key is also transient — never kept, and kept for the server, at once — since whichever the runtime
 * honoured the other would be silently wrong. Warned without `keepState`: nothing is kept, so there is nothing to
 * paint with.
 */
export const assertPaintedState = (author: SpaceAuthor): void => {
  const painted = stateKeyList(author, 'paintedState', ['toolPick', 'name'], 'the first paint shows');
  const transient = new Set(author.spec.settings?.transientState ?? []);
  const both = painted.filter(key => transient.has(key));
  if (both.length > 0) {
    throw new AuthoringError(
      'state-painted-and-transient',
      `\`settings.paintedState\` and \`settings.transientState\` both name ${both.map(key => `"${key}"`).join(', ')}. A painted key is kept, so the server can draw with it; a transient one never is. Remove ${both.length === 1 ? 'it' : 'them'} from one of the two.`
    );
  }

  // Kept for the server to draw with, a painted key is one the space keeps: with `keptState`, one it names.
  const kept = author.spec.settings?.keptState ?? [];
  const unkept = kept.length > 0 ? painted.filter(key => !kept.includes(key)) : [];
  if (unkept.length > 0) {
    throw new AuthoringError(
      'state-painted-not-kept',
      `\`settings.paintedState\` names ${unkept.map(key => `"${key}"`).join(', ')}, which \`settings.keptState\` does not keep — a painted key is kept, so the server can draw with it. Add ${unkept.length === 1 ? 'it' : 'them'} to \`keptState\`, or leave ${unkept.length === 1 ? 'it' : 'them'} out of \`paintedState\`.`
    );
  }

  if (painted.length > 0 && author.spec.settings?.keepState !== true) {
    author.styleWarnings.push({
      code: 'painted-state-without-keep-state',
      message:
        '`settings.paintedState` names kept keys for the server to draw with, but `settings.keepState` is not on — nothing is kept, so there is nothing to draw with. Turn `keepState` on, or remove `paintedState`.',
      details: { keys: painted }
    });
  }
};

/**
 * The visitors' roles and what each gives (`checkVisitorRoles`). Refused rather than repaired — a role written wrong
 * is a person who cannot do what they were given, or one who can do what they were not, and neither says so anywhere.
 */
export const assertVisitorRoles = (author: SpaceAuthor): void => {
  const roles: unknown = author.spec.settings?.visitorRoles;
  if (roles === undefined) {
    return;
  }

  const checked = checkVisitorRoles(roles);
  if (!checked.ok) {
    throw new AuthoringError('visitor-roles', checked.problem);
  }
};

/**
 * An element's `quiet`: suggestions' codes, and only those — a problem is never quieted, and a misspelt code would
 * quiet nothing while reading as if it did. Writes nothing into the documents: it is about the advice, not the page.
 */
export const assertQuiet = (quiet: unknown, where: string): void => {
  const suggestions = Object.entries(AUTHORING_CODES)
    .filter(([, entry]) => entry.kind === 'suggested')
    .map(([code]) => code);
  const wrong = (Array.isArray(quiet) ? quiet : [quiet]).filter(code => !isSuggestionCode(code));
  if (!Array.isArray(quiet) || wrong.length > 0) {
    throw new AuthoringError(
      'quiet-unknown',
      `${where} quiets ${wrong.map(code => JSON.stringify(code)).join(', ')}, which ${wrong.length === 1 ? 'is' : 'are'} no suggestion's code: \`quiet\` is a list of the codes suggestions were offered with — ${suggestions.join(', ')}${didYouMean(String(wrong[0]), suggestions) || '.'}`
    );
  }
};
