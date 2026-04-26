import type { Schema } from '@plitzi/sdk-shared';

export type BuilderContextElement = {
  id: string;
  label: string;
  type: string;
  parentId?: string;
  children: string[];
};

export type BuilderContextResult = {
  currentPageId: string | undefined;
  selectedElementId: string | undefined;
  // Compact element tree — omits attributes and styles (too large)
  elements: BuilderContextElement[];
};

// Returns a compact, AI-readable snapshot of the live builder state.
// Reads from in-memory store so it reflects unsaved changes.
export const buildBuilderContext = (
  schema: Schema | undefined,
  currentPageId: string | undefined,
  selectedElementId: string | undefined
): BuilderContextResult => {
  const elements: BuilderContextElement[] = [];

  if (schema?.flat) {
    for (const el of Object.values(schema.flat)) {
      elements.push({
        id: el.id,
        label: el.definition.label,
        type: el.definition.type,
        parentId: el.definition.parentId,
        children: el.definition.items ?? []
      });
    }
  }

  return { currentPageId, selectedElementId, elements };
};
