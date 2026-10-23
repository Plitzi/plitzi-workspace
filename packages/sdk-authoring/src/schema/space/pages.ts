import { getSlugParams } from '@plitzi/sdk-shared/navigation';

import { groupBindings, withVisibility } from '../bindings';
import { AuthoringError } from '../codes';
import { flagGateOf } from '../flags';
import { authorFlows } from '../flows';
import { pathForSlug, selectorFor } from '../handles';
import { assertPageNav, folderPrefixes, routeOf } from '../nav';
import { didYouMean } from '../suggest';
import { assertFlowShapes } from './checks';
import { addElement, insert, nextId } from './elements';
import { seoAttributes } from './seo';
import { baseSelectorFor } from './styles';
import { componentWhere, layoutAttributes, placeOf, undeclaredFolder } from './values';

import type { SpaceAuthor } from './author';
import type { ComponentSpec, LayoutRef, LayoutSpec, PageSpec } from '../types';
import type { Element, PageFolder, SpaceComponent } from '@plitzi/sdk-shared';

/**
 * Where a page's ids are derived from — its slug, unless another page already claimed it.
 *
 * Two pages SHARING one slug is a supported shape and the only way to put a sign-in and the page behind it on
 * one path: they differ by `accessLevel`, and the router picks. Derived from the slug alone they also shared
 * every id in their subtrees, and the second page's elements were refused one by one. Only the later page is
 * disambiguated, so no space that has no duplicate moves an id.
 */
/**
 * The folders, and the route prefix each one contributes.
 *
 * Resolved once, before any page is written, for the reason every other declaration is: a page names a folder by
 * id, and a name that answers to nothing has to be refused where it was written rather than becoming a page that
 * quietly answers at the wrong URL. Nesting is walked with a seen-set — a folder declared as its own ancestor is
 * a cycle, and the honest answer to it is a throw and not an infinite loop.
 */
export const buildPageFolders = (author: SpaceAuthor): PageFolder[] => {
  const declared = author.spec.pageFolders ?? [];
  const byId = new Map(declared.map(folder => [folder.id, folder]));

  for (const folder of declared) {
    if (folder.parent !== undefined && !byId.has(folder.parent)) {
      throw new AuthoringError(
        'folder-undeclared',
        `Page folder "${folder.id}" sits in "${folder.parent}", which this space does not declare${undeclaredFolder(folder.parent, byId.keys())}`
      );
    }
  }

  for (const folder of declared) {
    const seen = new Set<string>([folder.id]);
    let parent = folder.parent;
    while (parent !== undefined) {
      if (seen.has(parent)) {
        throw new AuthoringError('folder-cycle', `Page folder "${folder.id}" is inside itself, through "${parent}"`);
      }

      seen.add(parent);
      parent = byId.get(parent)?.parent;
    }
  }

  for (const [id, prefix] of folderPrefixes(declared)) {
    author.folderPrefixes.set(id, prefix);
  }

  return declared.map(folder => ({
    id: folder.id,
    name: folder.name ?? folder.id,
    slug: folder.slug ?? folder.id,
    ...(folder.parent === undefined ? {} : { parentId: folder.parent })
  }));
};

/** Where a page ANSWERS: its folder's chain of slugs, then its own. What a test navigates to. */
/**
 * Where a visitor a page is not for is sent, written the way the router reads it: a page's id, or an address off
 * this space.
 *
 * An author reaches for the page's id, its slug, its path or `''` for the home page, and all of them are resolved
 * here — the router takes an empty value for "no redirect", so `unauthorizedRedirect: ''`, meaning "the sign-in,
 * which is the home page", used to be dropped without a word: a visitor signing out of a members page was left on
 * "Access Denied", with the flow that would have navigated away unmounted under it.
 */
export const writeRedirect = (author: SpaceAuthor, page: PageSpec, id: string): void => {
  if (page.unauthorizedRedirect === undefined) {
    return;
  }

  const element = author.flatMap.flat[id];
  author.flatMap.updateElement({
    ...element,
    attributes: {
      ...element.attributes,
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: redirectTarget(author, page.unauthorizedRedirect, `Page "${page.name}"`)
    }
  });
};

const redirectTarget = (author: SpaceAuthor, target: string, where: string): string => {
  // Somewhere else — a whole URL, or one a template fills at run time (`{{authUrl}}/`) — is kept as written.
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(target) || target.includes('{{')) {
    return target;
  }

  const pages = Object.values(author.handles);
  const path = pathForSlug(target.replace(/^\/+|\/+$/gu, ''));
  const page = pages.find(candidate => candidate.id === target) ?? pages.find(candidate => candidate.path === path);
  if (!page) {
    const names = pages.flatMap(candidate => [candidate.id, candidate.path]);
    throw new AuthoringError(
      'redirect-target-unknown',
      `${where} sends a visitor it is not for to "${target}", which is no page of this space${didYouMean(target, names)}. Write a page's id or slug (\`''\` is the home page), or a full URL for somewhere else.`
    );
  }

  return page.id;
};

const routeFor = (author: SpaceAuthor, page: PageSpec): string => {
  return routeOf(page, author.folderPrefixes);
};

const pathFor = (author: SpaceAuthor, page: PageSpec, index: number): string => {
  const base = `${author.spec.permanentUrl}/${page.slug || 'home'}`;
  const path = author.pagePaths.has(base) ? `${base}#${index}` : base;
  author.pagePaths.add(path);

  return path;
};

export const addPage = (author: SpaceAuthor, page: PageSpec, index: number): string => {
  const path = pathFor(author, page, index);
  const id = page.id ?? nextId(author, 'page');
  assertFlowShapes(page.flows, `Page "${page.name}"`);
  assertPageNav(page);
  if (page.folder !== undefined && !author.folderPrefixes.has(page.folder)) {
    throw new AuthoringError(
      'folder-undeclared',
      `Page "${page.name}" is in folder "${page.folder}", which this space does not declare${undeclaredFolder(page.folder, author.folderPrefixes.keys(), page)}`
    );
  }

  const element: Element = {
    id,
    attributes: {
      slug: page.slug,
      default: page.isDefault ?? index === 0,
      name: page.name,
      ...(page.folder === undefined ? {} : { folder: page.folder }),
      ...layoutAttributes(page.layout),
      ...(page.accessLevel ? { accessLevel: page.accessLevel } : {}),
      ...(page.access ? { access: { permissions: [...page.access.permissions] } } : {}),
      seoEnabled: Boolean(
        page.seoTitle ?? page.seoDescription ?? page.robots ?? page.structuredData ?? page.seoImage ?? page.seoType
      ),
      ...(page.seoTitle ? { seoPageTitle: page.seoTitle } : {}),
      ...(page.seoDescription ? { seoPageDescription: page.seoDescription } : {}),
      ...seoAttributes(`Page "${page.name}"`, page),
      ...(page.notFound ? { notFound: page.notFound } : {}),
      ...(page.documentScroll ? { documentScroll: page.documentScroll } : {})
    },
    definition: {
      label: 'Page',
      type: 'page',
      rootId: id,
      items: [],
      styleSelectors: {
        base: baseSelectorFor(author, path, id, {
          type: 'page',
          css: page.css,
          class: page.class,
          selector: page.selector
        })
      },
      ...(page.flows ? { interactions: authorFlows(page.flows, id) } : {}),
      ...(page.flag === undefined ? {} : { flag: flagGateOf(page.flag, `Page "${page.name}"`) })
    }
  };

  // `custom` is the one drop position that inserts without a parent, which is what a page is.
  insert(author, element, '', 'custom', path);

  author.handles[id] = {
    id,
    type: 'page',
    pageId: id,
    selector: selectorFor(id),
    named: page.id !== undefined,
    slug: page.slug,
    path: routeFor(author, page),
    ...(page.accessLevel ? { accessLevel: page.accessLevel } : {}),
    ...(page.access ? { access: { permissions: [...page.access.permissions] } } : {}),
    params: getSlugParams(page.slug),
    ...(page.layout ? { layout: page.layout.id } : {}),
    elements: {}
  };

  page.body.forEach((child, childIndex) =>
    addElement(author, child, `${path}/${childIndex}`, placeOf(child, `Page "${page.name}"`, childIndex), id, id)
  );

  return id;
};

/**
 * A component: its tree written into a `flat` of its own, rooted at its root element, and its declaration held to
 * that tree — every slot one of its elements.
 */
export const addComponent = (author: SpaceAuthor, component: ComponentSpec): SpaceComponent => {
  const where = componentWhere(component);
  const tree = author.componentTrees.get(component.id);
  if (!tree) {
    throw new Error(`${where} was not collected before it was written`);
  }

  const rootId = addElement(
    author,
    component.root,
    `${author.spec.permanentUrl}/component:${component.id}`,
    placeOf(component.root, `Component "${component.id}"`),
    '',
    '',
    'shown',
    tree
  );
  const ids = Object.keys(tree.map.flat);
  for (const slot of component.slots ?? []) {
    if (!ids.includes(slot)) {
      throw new AuthoringError(
        'slot-unknown',
        `${where} declares the slot "${slot}", which is not an element of its tree${didYouMean(slot, ids) || '.'} A slot is an element inside the component — usually an empty container — that an instance fills.`
      );
    }
  }

  return {
    id: component.id,
    ...(component.label ? { label: component.label } : {}),
    ...(component.folder ? { folder: component.folder } : {}),
    ...(component.props ? { props: component.props } : {}),
    ...(component.slots ? { slots: component.slots } : {}),
    rootId,
    flat: tree.map.flat
  };
};

/**
 * A shell pages render inside: a root of its own, written like a page but listed as none.
 *
 * It is inserted with no parent, the way a page is, and its elements carry it as their `rootId` — which is what
 * the validator and the builder read to tell a shell's elements from a page's. It is never in `schema.pages`:
 * it has no route, and a visitor only ever reaches it through a page that names it.
 */
export const addLayout = (author: SpaceAuthor, layout: LayoutSpec): void => {
  const path = `${author.spec.permanentUrl}/layout:${layout.id}`;
  const where = `Layout "${layout.id}"`;
  assertFlowShapes(layout.flows, where);
  if (layout.folder && !author.folderPrefixes.has(layout.folder)) {
    throw new AuthoringError(
      'folder-undeclared',
      `${where} is filed in folder "${layout.folder}", which this space does not declare${undeclaredFolder(layout.folder, author.folderPrefixes.keys(), layout)}`
    );
  }

  const bindings = withVisibility({ bind: layout.bind });
  const sourceIndex = author.options.sourceTypes ? author.sources : undefined;
  const element: Element = {
    id: layout.id,
    attributes: {
      // The one attribute the element declares a default for, merged the way a factory merges it.
      subType: 'div',
      ...layout.attributes,
      ...(layout.folder ? { folder: layout.folder } : {}),
      ...layoutAttributes(layout.layout)
    },
    definition: {
      label: layout.label ?? 'Layout Container',
      type: 'layoutContainer',
      rootId: layout.id,
      items: [],
      styleSelectors: { base: baseSelectorFor(author, path, layout.id, { type: 'layoutContainer', ...layout }) },
      initialState: { visibility: true },
      ...(bindings?.length ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
      ...(layout.flows ? { interactions: authorFlows(layout.flows, layout.id) } : {})
    }
  };

  insert(author, element, '', 'custom', path);
  author.layoutHandles[layout.id] = {
    id: layout.id,
    type: 'layoutContainer',
    pageId: layout.id,
    selector: selectorFor(layout.id),
    named: true,
    ...(layout.layout ? { layout: layout.layout.id } : {}),
    elements: {}
  };
  layout.body.forEach((child, index) =>
    addElement(author, child, `${path}/${index}`, placeOf(child, `Layout "${layout.id}"`, index), layout.id, layout.id)
  );
};

/**
 * A page's shell has to be a layout, and its slot an element inside THAT layout.
 *
 * Both are plain strings in the document and the runtime asks nothing of them: a slot that is not inside the
 * shell renders the shell with the page nowhere in it, and every check below this one considers that valid.
 */
export const assertLayoutRef = (author: SpaceAuthor, layout: LayoutRef | undefined, where: string): void => {
  if (!layout) {
    return;
  }

  const declared = (author.spec.layouts ?? []).map(candidate => candidate.id);
  if (!declared.includes(layout.id)) {
    throw new AuthoringError(
      'layout-undeclared',
      `${where} renders inside the layout "${layout.id}", which this space does not declare${didYouMean(layout.id, declared)}`
    );
  }

  const slot = author.flatMap.flat[layout.slot] as Element | undefined;
  if (!slot || slot.definition.rootId !== layout.id || slot.id === layout.id) {
    throw new AuthoringError(
      'layout-slot-unknown',
      `${where} puts its body in "${layout.slot}", which is not an element inside the layout "${layout.id}". The slot is where the body goes, so it has to be part of the shell.`
    );
  }
};
