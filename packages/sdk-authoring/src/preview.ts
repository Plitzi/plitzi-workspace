import { readFileSync } from 'node:fs';

import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PREVIEW_FILE_ENV, PREVIEW_SLUG, previewCopyId } from '@plitzi/sdk-shared/project';

import { container } from './elements';
import { component, element } from './elements/element';

import type { PageSpec, SpaceSpec } from './schema/types';

/**
 * Why the element asked to be drawn alone cannot be: a name that is no component or type, an address the space uses, a
 * file that is not one. Its message is the whole report — a project's server says it alone, with no stack.
 */
export class SpacePreviewError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SpacePreviewError';
  }
}

// A bundler renames a class it inlines; the server tells its reports by this name.
Object.defineProperty(SpacePreviewError, 'name', { value: 'SpacePreviewError' });

/**
 * One element of the space drawn alone, in copies: a component it declares, each copy with its props, or an element
 * type — a plugin's, a built-in — each with its attributes. What a reviewer looks at when no page places it yet: a
 * run's reviewers wrote probe pages in their scratch to see a plugin with `status` undefined, then `'banana'`.
 */
export interface ElementPreview {
  element: string;
  /** Each copy's props (a component) or attributes (an element), drawn one under the other. At least one. */
  copies: Record<string, unknown>[];
}

const PREVIEW_ID = PREVIEW_SLUG;

const BUILT_IN: ReadonlySet<string> = new Set(Object.values(elementDeclarations).map(declaration => declaration.type));

/** A preview file read as one, or why it is not, said whole. */
export const parsePreview = (value: unknown): ElementPreview | { problem: string } => {
  if (!isRecord(value) || typeof value.element !== 'string' || value.element === '') {
    return {
      problem: 'it names no element: write { "element": "<a component or an element type>", "copies": [{ … }] }'
    };
  }

  const { element: name, copies } = value;
  if (!Array.isArray(copies) || copies.length === 0 || !copies.every(isRecord)) {
    return {
      problem: `"copies" is not a list of objects: each copy is the props or the attributes of one "${name}" — [{}] draws one as it is declared`
    };
  }

  return { element: name, copies: copies.filter(isRecord) };
};

/**
 * The space with a page of its own drawing `preview` alone, at `PREVIEW_SLUG`, in no layout — the space's theme, fonts
 * and classes as any page has them. A page the space already answers there is refused: the preview would hide it.
 */
export const withPreview = (
  space: SpaceSpec,
  preview: ElementPreview,
  /** The element types the project's plugins bring, beside the built-in ones. */
  pluginTypes: readonly string[] = []
): SpaceSpec => {
  if (space.pages.some(page => page.slug === PREVIEW_SLUG && page.folder === undefined)) {
    throw new SpacePreviewError(
      `The space has a page at /${PREVIEW_SLUG} already: an element is drawn alone there — rename that page's slug to look at one`
    );
  }

  const components = (space.components ?? []).map(each => each.id);
  const isComponent = components.includes(preview.element);
  // A name that is neither draws nothing, which a look would picture as an empty page: refused, with what there is.
  if (!isComponent && !pluginTypes.includes(preview.element) && !BUILT_IN.has(preview.element)) {
    throw new SpacePreviewError(
      `"${preview.element}" is no component of the space and no element type to draw alone: its components are ${components.join(', ') || 'none'}; its plugins' elements ${pluginTypes.join(', ') || 'none'} — or a built-in type (heading, container…)`
    );
  }

  const page: PageSpec = {
    id: PREVIEW_ID,
    name: `${preview.element}, alone`,
    slug: PREVIEW_SLUG,
    robots: 'noindex, nofollow',
    body: [
      container({
        id: `${PREVIEW_ID}-copies`,
        css: { display: 'flex', 'flex-direction': 'column', 'row-gap': '48px', padding: '48px 24px' },
        children: preview.copies.map((copy, index) =>
          isComponent
            ? component(preview.element, { id: previewCopyId(index), props: copy })
            : element(preview.element, { ...copy, id: previewCopyId(index) })
        )
      })
    ]
  };

  return { ...space, pages: [...space.pages, page] };
};

/**
 * The preview the process is started with (`PREVIEW_FILE_ENV`), read: undefined when it names none. A file that is not
 * one is refused, saying what to write — never a space served without the page it was started to draw.
 */
export const previewOfProcess = (): ElementPreview | undefined => {
  const file = process.env[PREVIEW_FILE_ENV];
  if (file === undefined || file === '') {
    return undefined;
  }

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new SpacePreviewError(
      `${PREVIEW_FILE_ENV} names ${file}, which is not JSON to read: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  const preview = parsePreview(value);
  if ('problem' in preview) {
    throw new SpacePreviewError(
      `${PREVIEW_FILE_ENV} names ${file}, which is not an element to draw alone: ${preview.problem}`
    );
  }

  return preview;
};
