import { didYouMean } from '../schema/suggest';

import type { ElementSpec, PageSpec, SpaceSpec } from '../schema';

/** What a variant may change on one element: anything but what makes it that element. */
export type ElementPatch = Partial<Omit<ElementSpec, 'type' | 'id' | 'children'>>;

/**
 * A space with nothing but one page, for a test that is about what is ON it.
 *
 * ```ts
 * const { schema, style, handles } = authorSpace(singlePageSpace([heading('Hi', { id: 'title', subType: 'h1' })]));
 * ```
 *
 * Everything else — the variables, the classes, the page's own fields — goes in `space`, and `space.page` is merged
 * onto the page, so a test states only what it is about.
 */
export const singlePageSpace = (
  body: ElementSpec[],
  space: Partial<Omit<SpaceSpec, 'pages'>> & { page?: Partial<Omit<PageSpec, 'body'>> } = {}
): SpaceSpec => {
  const { page, ...rest } = space;

  return { name: 'Test', permanentUrl: 'test', ...rest, pages: [{ name: 'Home', slug: '', ...page, body }] };
};

const patchTree = (elements: ElementSpec[], id: string, patch: ElementPatch): { tree: ElementSpec[]; hit: boolean } => {
  let hit = false;
  const tree = elements.map(element => {
    if (hit) {
      return element;
    }

    if (element.id === id) {
      hit = true;

      return {
        ...element,
        ...patch,
        ...(patch.attributes ? { attributes: { ...element.attributes, ...patch.attributes } } : {})
      };
    }

    if (!element.children) {
      return element;
    }

    const inner = patchTree(element.children, id, patch);
    hit = inner.hit;

    return inner.hit ? { ...element, children: inner.tree } : element;
  });

  return { tree, hit };
};

const namesIn = (elements: ElementSpec[]): string[] =>
  elements.flatMap(element => [...(element.id ? [element.id] : []), ...namesIn(element.children ?? [])]);

/**
 * The same space with one element changed — "same page, one thing different", which is most of what a suite renders.
 *
 * ```ts
 * authorSpace(withElement(space, 'hero-title', { attributes: { content: 'Second render' } }))
 * ```
 *
 * On the SPEC, not on the authored documents, so the variant goes through `authorSpace` like anything else: a patch
 * that leaves the element invalid is refused with the same message a first draft would get, instead of rendering as
 * a document no author could have written. `attributes` merge onto the element's own; every other field replaces.
 * The spec passed in is not touched.
 */
export const withElement = (spec: SpaceSpec, id: string, patch: ElementPatch): SpaceSpec => {
  const found = { hit: false };
  const patchRoots = <R extends { body: ElementSpec[] }>(roots: R[]): R[] =>
    roots.map(root => {
      if (found.hit) {
        return root;
      }

      const result = patchTree(root.body, id, patch);
      found.hit = result.hit;

      return result.hit ? { ...root, body: result.tree } : root;
    });
  const pages = patchRoots(spec.pages);
  const layouts = patchRoots(spec.layouts ?? []);

  if (!found.hit) {
    const names = [...spec.pages, ...(spec.layouts ?? [])].flatMap(root => namesIn(root.body));
    throw new Error(`No element with id "${id}" in "${spec.name}"${didYouMean(id, names)}`);
  }

  return { ...spec, pages, ...(spec.layouts ? { layouts } : {}) };
};
