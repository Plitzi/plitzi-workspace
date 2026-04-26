import { EMPTY_SCHEMA } from '@plitzi/sdk-shared';

import type { AiMessagePreview } from '../types';

// AI-friendly element description — no SDK internals required
export type PreviewElement = {
  id: string;
  // SDK element types: 'container' | 'heading' | 'button' | 'text' | 'image' | etc.
  type: string;
  label: string;
  parentId?: string;
  // Ordered list of child IDs (for containers)
  children?: string[];
  // Component-specific attributes (e.g. { content: 'Hello', subType: 'h2' })
  attributes?: Record<string, unknown>;
  // CSS properties in kebab-case → value (e.g. { 'background-color': '#7c3aed' })
  styles?: Record<string, string>;
};

export type StagePreviewArgs = {
  baseElementId: string;
  elements: PreviewElement[];
};

export type StagePreviewResult = {
  success: true;
  elementCount: number;
};

type TemplatePreview = Extract<AiMessagePreview, { baseElementId: string }>;

const buildCacheString = (className: string, styles: Record<string, string>) => {
  const props = Object.entries(styles)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  return `.${className}{${props}}`;
};

// Transforms the AI's simple element description into the SDK's schema + style format.
// AI provides intent; the frontend handles SDK internals.
export const transformStagePreview = (args: StagePreviewArgs): TemplatePreview => {
  const flat: Record<string, unknown> = {};
  const desktop: Record<string, unknown> = {};

  for (const el of args.elements) {
    // Each element gets a unique, prefixed CSS class to avoid collisions with real elements
    const className = `aip-${el.id}`;

    flat[el.id] = {
      id: el.id,
      attributes: el.attributes ?? {},
      definition: {
        rootId: args.baseElementId,
        parentId: el.parentId,
        label: el.label,
        type: el.type,
        styleSelectors: { base: className },
        bindings: {},
        interactions: {},
        initialState: { visibility: true },
        items: el.children ?? []
      }
    };

    if (el.styles && Object.keys(el.styles).length > 0) {
      desktop[className] = {
        name: className,
        type: 'class',
        attributes: { base: { default: el.styles } },
        cache: buildCacheString(className, el.styles)
      };
    }
  }

  return {
    baseElementId: args.baseElementId,
    schema: { flat: EMPTY_SCHEMA.schema['flat'] },
    style: { platform: EMPTY_SCHEMA.style['platform'] }
  };
};
