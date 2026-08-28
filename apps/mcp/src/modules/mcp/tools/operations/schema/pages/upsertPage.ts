import { z } from 'zod';

import {
  empty,
  fail,
  findFolderByRef,
  findLayoutByRef,
  findPageByRef,
  indexAddPage,
  resolveRef
} from '../../../../helpers';
import { guardNewRef, layoutsUri, pageUri, pagesUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { Element } from '@plitzi/sdk-shared';

export const upsertPageOp = z
  .object({
    type: z.literal('upsertPage'),
    ref: z
      .string()
      .describe(
        'Page id to update, or a new id you choose to create one. The id IS the page name — starts with a letter, ' +
          'then letters, numbers, hyphens and underscores ("pricing"), unique across the space.'
      ),
    label: z.string().optional(),
    slug: z
      .string()
      .optional()
      .describe(
        'The page URL path, RELATIVE — never start it with "/" (parent folder slugs prepend it; a leading "/" is ' +
          'stripped). Set one on create for a stable route: "pricing", "posts/:postId". A ":name" segment is a ' +
          'route param, readable as {{name}} and as navigation.routeParams.name. Omitted → the page ref is used.'
      ),
    folder: z
      .string()
      .nullable()
      .optional()
      .describe('Ref of an existing folder to place this page in; "" or null moves it to the root. Unknown → error'),
    default: z.boolean().optional(),
    layout: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Ref of the shared layout shell this page renders inside (header/sidebar/footer). "" or null detaches the ' +
          'page from its layout. Create a shell with upsertLayout; read plitzi://schema/{env}/layouts for the ones ' +
          'that exist.'
      ),
    layoutContainer: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Ref of the container INSIDE that shell where a page body is rendered — the slot. Must be an element of ' +
          'the layout named above. Without it the page body has nowhere to go and the shell renders alone.'
      ),
    enabled: z
      .boolean()
      .optional()
      .describe(
        'false disables the page in the published SDK runtime (not routable/accessible to end users); it stays ' +
          'editable here. Defaults to true'
      )
  })
  .describe('Create a page, or update it when ref already exists (only the fields you pass change).');

export type UpsertPage = z.infer<typeof upsertPageOp>;

export const upsertPage = (space: Space, env: Env, op: UpsertPage): OpResult => {
  // A page slug is RELATIVE: the navigation runtime prepends the leading '/' (and any parent folder slugs) when it
  // builds the route, so a stored leading slash would double it (`//pricing`). Strip it here so a slug the agent
  // wrote as "/pricing" persists as "pricing" and the URL is well formed.
  const slug = op.slug === undefined ? undefined : op.slug.replace(/^\/+/, '');

  // The stored `folder` is always either '' (root) or an existing folder id — never a dangling ref. undefined =
  // leave as-is; null or '' = move to root; any other ref must resolve to an existing folder or the op fails.
  let folderValue: string | undefined;
  if (op.folder !== undefined) {
    if (op.folder === null || op.folder === '') {
      folderValue = '';
    } else {
      const resolved = findFolderByRef(space.schema, op.folder);
      if (!resolved) {
        return fail(
          'folder',
          `Folder "${op.folder}" not found`,
          'Create it with upsertFolder, or read plitzi://folders'
        );
      }

      folderValue = resolved.id;
    }
  }

  /**
   * The two halves of "this page is rendered inside that shell", resolved together because they are one decision.
   *
   * `layout` names the shell — a root of its own — and `layoutContainer` names the slot INSIDE it. Naming a slot
   * that belongs to some other tree is the failure worth catching here: it stores fine, and the page then renders
   * its body into a container the shell never shows.
   */
  let layoutValue: string | undefined;
  let slotValue: string | undefined;
  if (op.layout !== undefined) {
    if (op.layout === null || op.layout === '') {
      layoutValue = '';
    } else if (!findLayoutByRef(space.schema, op.layout)) {
      return fail(
        'layout',
        `Layout "${op.layout}" not found`,
        'Create it with upsertLayout, or read plitzi://schema/' + env + '/layouts'
      );
    } else {
      layoutValue = op.layout;
    }
  }

  if (op.layoutContainer !== undefined) {
    if (op.layoutContainer === null || op.layoutContainer === '') {
      slotValue = '';
    } else {
      const existingPage = findPageByRef(space.schema, op.ref);
      const shellRef = layoutValue ?? (existingPage?.attributes.layout as string | undefined);
      const shell = shellRef ? findLayoutByRef(space.schema, shellRef) : undefined;
      if (!shell) {
        return fail(
          'layoutContainer',
          'A slot needs a layout to be part of',
          'Pass `layout` in the same op (or set it first) so the slot can be checked against that shell'
        );
      }

      if (!resolveRef(space.schema, shell, op.layoutContainer)) {
        return fail(
          'layoutContainer',
          `"${op.layoutContainer}" is not an element of layout "${shell.id}"`,
          `Read plitzi://schema/${env}/pages/${shell.id} and name a container from that tree`
        );
      }

      slotValue = op.layoutContainer;
    }
  }

  const existing = findPageByRef(space.schema, op.ref);
  if (existing) {
    // A page is addressed by its id, which none of these attributes feeds — so an update touches no index key.
    existing.attributes = {
      ...existing.attributes,
      ...(slug !== undefined ? { slug } : {}),
      ...(op.label !== undefined ? { name: op.label } : {}),
      ...(op.default !== undefined ? { default: op.default } : {}),
      ...(op.enabled !== undefined ? { enabled: op.enabled } : {}),
      ...(folderValue !== undefined ? { folder: folderValue } : {}),
      ...(layoutValue !== undefined ? { layout: layoutValue } : {}),
      ...(slotValue !== undefined ? { layoutContainer: slotValue } : {})
    };

    return {
      ...empty(),
      updated: 1,
      staleResources: [pageUri(env, op.ref), pagesUri(env), ...(layoutValue === undefined ? [] : [layoutsUri(env)])]
    };
  }

  // Creating: the name becomes this page's id, so it must pass the same charset/uniqueness guard as any element.
  const guard = guardNewRef(space, op.ref, 'ref');
  if (guard) {
    return guard;
  }

  const id = op.ref;
  const attributes: Element['attributes'] = {
    slug: slug ?? op.ref,
    name: op.label ?? op.ref,
    default: op.default ?? false,
    enabled: op.enabled ?? true,
    folder: folderValue ?? '',
    layout: layoutValue ?? '',
    layoutContainer: slotValue ?? ''
  };
  const page: Element = {
    id,
    attributes,
    definition: {
      rootId: id,
      label: op.label ?? op.ref,
      type: 'page',
      items: [],
      styleSelectors: { base: '' }
    }
  };
  space.schema.flat[id] = page;
  space.schema.pages.push(id);
  indexAddPage(space.schema, page);

  return {
    ...empty(),
    created: 1,
    staleResources: [pageUri(env, op.ref), pagesUri(env), ...(layoutValue ? [layoutsUri(env)] : [])]
  };
};
