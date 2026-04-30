import type { Schema } from '@plitzi/sdk-shared';

export type BuilderContextElement = {
  id: string;
  label: string;
  type: string;
  parentId?: string;
};

export type BuilderContextResult = {
  currentPageId: string | undefined;
  selectedElementId: string | undefined;
  elements: BuilderContextElement[];
};

// Compact, AI-readable snapshot of the live builder state (in-memory, reflects unsaved changes).
// Scoped to the current page + its layout when known; parentId encodes the full tree structure.
export const buildBuilderContext = (
  schema: Schema | undefined,
  currentPageId: string | undefined,
  selectedElementId: string | undefined
): BuilderContextResult => {
  const elements: BuilderContextElement[] = [];

  if (schema?.flat) {
    // Resolve layout ID from the page element's attributes so layout elements are included
    const layoutId =
      currentPageId && typeof schema.flat[currentPageId].attributes.layout === 'string'
        ? schema.flat[currentPageId].attributes.layout
        : undefined;

    for (const el of Object.values(schema.flat)) {
      const rootId = el.definition.rootId;
      if (currentPageId && rootId !== currentPageId && rootId !== layoutId) {
        continue;
      }

      elements.push({
        id: el.id,
        label: el.definition.label,
        type: el.definition.type,
        parentId: el.definition.parentId
      });
    }
  }

  return { currentPageId, selectedElementId, elements };
};
