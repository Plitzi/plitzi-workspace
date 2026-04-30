import generateStyleSelector from '@plitzi/sdk-style/helpers/generateStyleSelector';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import getRootNode from '../helpers/getRootNode';

import type { AiMessagePreview } from '../types';
import type { Schema, Style, StyleItem } from '@plitzi/sdk-shared';

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
  // CSS properties in kebab-case → value. Applied at desktop breakpoint (default).
  styles?: Record<string, string>;
  // Per-breakpoint overrides. Only include properties that differ from the desktop value.
  tablet?: Record<string, string>;
  mobile?: Record<string, string>;
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

const applyStyles = (
  map: Style['platform']['desktop'],
  className: string,
  styles: Record<string, string>
) => {
  map[className] = generateStyleSelector(className, 'class', { base: { default: styles } }, {}) as StyleItem;
};

// Transforms the AI's simple element description into the SDK's schema + style format.
// AI provides intent; the frontend handles SDK internals.
export const transformStagePreview = (args: StagePreviewArgs): TemplatePreview => {
  const flat: Schema['flat'] = {};
  const desktop: Style['platform']['desktop'] = {};
  const tablet: Style['platform']['tablet'] = {};
  const mobile: Style['platform']['mobile'] = {};

  if (args.elements.length > 0 && args.baseElementId) {
    const { rootNode, rootStyle, rootStyleSelector } = getRootNode(undefined, { centered: true });
    flat[rootNode.id] = { ...rootNode, definition: { ...rootNode.definition, items: [args.elements[0].id] } };
    args.baseElementId = rootNode.id;
    args.elements[0].parentId = rootNode.id;
    desktop[rootStyleSelector] = rootStyle;
  }

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
        items: el.children
      }
    };

    if (el.styles && Object.keys(el.styles).length > 0) applyStyles(desktop, className, el.styles);
    if (el.tablet && Object.keys(el.tablet).length > 0) applyStyles(tablet, className, el.tablet);
    if (el.mobile && Object.keys(el.mobile).length > 0) applyStyles(mobile, className, el.mobile);
  }

  const platform = { desktop, tablet, mobile };

  return {
    baseElementId: args.baseElementId,
    schema: { flat },
    style: { platform, cache: generateCache({ platform } as Style) }
  };
};
