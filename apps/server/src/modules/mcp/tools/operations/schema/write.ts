import { generateObjectId } from '../../../helpers';

import type { ElementInput } from './shared';
import type { Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { Element } from '@plitzi/sdk-shared';

// Shared mutation utilities for the element-schema handlers: stale-resource URI builders and the low-level tree
// operations (create/place/detach) the upsert/move handlers reuse.

export const pageUri = (env: Env, ref: string): string => `plitzi://schema/${env}/pages/${ref}`;
export const pagesUri = (env: Env): string => `plitzi://schema/${env}/pages`;
export const foldersUri = (env: Env): string => `plitzi://folders/${env}`;
export const folderUri = (env: Env, ref: string): string => `plitzi://folders/${env}/${ref}`;
export const schemaVarsUri = (env: Env): string => `plitzi://schema-variables/${env}`;

export const removeFromParent = (space: Space, childId: string): void => {
  for (const el of Object.values(space.schema.flat)) {
    if (el.definition.items?.includes(childId)) {
      el.definition.items = el.definition.items.filter(id => id !== childId);
    }
  }
};

export const placeChild = (parent: Element, childId: string, index?: number): void => {
  const items = parent.definition.items ?? (parent.definition.items = []);
  if (index === undefined || index < 0 || index >= items.length) {
    items.push(childId);
  } else {
    items.splice(index, 0, childId);
  }
};

export const createElement = (
  space: Space,
  page: Element,
  input: ElementInput,
  parent: Element,
  index: number | undefined
): void => {
  const id = generateObjectId();
  const { subType, ...props } = { subType: input.subType, ...input.props };
  const styleSelectors: Record<string, string> = { base: (input.style?.base ?? []).join(' ') };
  for (const [slot, classes] of Object.entries(input.style?.slots ?? {})) {
    styleSelectors[slot] = classes.join(' ');
  }

  space.schema.flat[id] = {
    id,
    attributes: subType === undefined ? props : { subType, ...props },
    definition: {
      rootId: page.id,
      parentId: parent.id,
      label: input.label ?? input.ref,
      type: input.type,
      items: [],
      styleSelectors: styleSelectors as { base: string; [selector: string]: string },
      aiRef: input.ref
    }
  };
  placeChild(parent, id, index);

  for (const child of input.children ?? []) {
    createElement(space, page, child, space.schema.flat[id], undefined);
  }
};
