import { sameSelector, selectorsOf } from '@plitzi/sdk-shared/style/snippetStyle';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';

import { documentIds } from './components';
import { remapCollidingIds } from './elementId';

import type { DisplayMode, Element, Schema, SnippetStyle, Style, StyleItem } from '@plitzi/sdk-shared';

type Elements = Record<Element['id'], Element>;

/** The first name of the form `name-2`, `name-3`… that none of `taken` holds. */
const freeName = (name: string, taken: Set<string>): string => {
  let suffix = 2;
  while (taken.has(`${name}-${suffix}`)) {
    suffix += 1;
  }

  return `${name}-${suffix}`;
};

/**
 * The classes a snippet brings that the space already uses for something else, each under a free name, keyed by
 * the name it arrived with.
 *
 * Only a class (or an id) is renamed: a rule written for every element of a type belongs to the space, which keeps its
 * own and never takes the snippet's. A class that says the same in both is kept as it is and shared, as a duplicated
 * element shares its classes.
 */
const collidingClasses = (space: Style['platform'], snippet: Style['platform']): Map<string, string> => {
  const taken = new Set([...selectorsOf(space), ...selectorsOf(snippet)]);
  const renamed = new Map<string, string>();
  selectorsOf(snippet).forEach(name => {
    const item = Object.values(snippet).find(items => Object.hasOwn(items, name))?.[name];
    if (item?.type === 'element' || !selectorsOf(space).has(name) || sameSelector(name, space, snippet)) {
      return;
    }

    const free = freeName(name, taken);
    taken.add(free);
    renamed.set(name, free);
  });

  return renamed;
};

/**
 * A rule under its new name, and every class it names inside an ancestor under theirs — recompiled when either
 * changed, since the CSS it carries is what a page loads, and the old name in it would style the space's own class.
 */
const renamedRule = (item: StyleItem, name: string, renamed: Map<string, string>): StyleItem => {
  let touched = name !== item.name;
  const attributes = Object.fromEntries(
    Object.entries(item.attributes).map(([selector, block]) => {
      if (!block.ancestors || !Object.keys(block.ancestors).some(ancestor => renamed.has(ancestor))) {
        return [selector, block];
      }

      touched = true;
      const ancestors = Object.fromEntries(
        Object.entries(block.ancestors).map(([ancestor, rule]) => [renamed.get(ancestor) ?? ancestor, rule])
      );

      return [selector, { ...block, ancestors }];
    })
  );
  if (!touched) {
    return item;
  }

  const rule = { ...item, name, attributes };

  return { ...rule, cache: processSelector(rule) };
};

const renameInStyle = (style: SnippetStyle, renamed: Map<string, string>): SnippetStyle => {
  if (renamed.size === 0) {
    return style;
  }

  const platform = { ...style.platform };
  (Object.keys(platform) as DisplayMode[]).forEach(mode => {
    platform[mode] = Object.fromEntries(
      Object.entries(platform[mode]).map(([name, item]) => {
        const next = renamed.get(name) ?? name;

        return [next, renamedRule(item, next, renamed)];
      })
    );
  });

  return { ...style, platform };
};

/** Each element wearing a renamed class, wearing it under the new name — the elements are already copies. */
const renameInElements = (elements: Elements, renamed: Map<string, string>): void => {
  Object.values(elements).forEach(element => {
    const { styleSelectors } = element.definition;
    Object.keys(styleSelectors).forEach(selector => {
      styleSelectors[selector] = styleSelectors[selector]
        .split(/\s+/)
        .map(name => renamed.get(name) ?? name)
        .join(' ');
    });
  });
};

/**
 * A snippet, fitted to the space it is about to enter: its elements and its classes under names that are free there.
 *
 * A snippet arrives from a document nobody here has seen, and the names it brought may not be free — dropping the same
 * snippet twice is enough. Only what collides changes, and everything that pointed at it is repointed with it: the
 * names an author gave are why the snippet reads well, and a space with no `hero` should get one called `hero`.
 *
 * - An element whose id the space holds is renamed (`remapCollidingIds`).
 * - A class the space uses for something else is renamed, in the snippet's style and on the elements that wear it, so
 *   the space's own `.card` is not restyled by the snippet's. One that says the same is shared.
 * - Rules for an element type, and tokens, are left for the merge (`mergeSnippetStyle`), which adds what the space
 *   lacks and keeps what it has.
 *
 * Decided once, where somebody dropped it, and carried by the insert from there: the editor, the server it is saved to
 * and every collaborator it is broadcast to then insert the same names, and one that stopped being free on the way is
 * refused there rather than stored under another name. Copied first: the snippet belongs to whoever passed it.
 */
const fitSnippet = (
  space: { schema: Pick<Schema, 'flat' | 'components'>; style: Pick<Style, 'platform'> },
  snippet: { data: Element; initialItems?: Elements; style?: SnippetStyle }
): { data: Element; initialItems: Elements; style?: SnippetStyle } => {
  const arriving = structuredClone({ ...snippet.initialItems, [snippet.data.id]: snippet.data });
  const taken = documentIds(space.schema);
  const renamedIds = remapCollidingIds(arriving, candidate => taken.has(candidate));
  const renamedClasses = snippet.style
    ? collidingClasses(space.style.platform, snippet.style.platform)
    : new Map<string, string>();
  renameInElements(arriving, renamedClasses);
  const { [renamedIds[snippet.data.id] ?? snippet.data.id]: data, ...initialItems } = arriving;

  return { data, initialItems, style: snippet.style && renameInStyle(snippet.style, renamedClasses) };
};

export default fitSnippet;
