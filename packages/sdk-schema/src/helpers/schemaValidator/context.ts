/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { SchemaValidationError, SchemaValidationOptions } from './types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** What every check of one validation shares: the document's parts, what was found so far, and how its roots are read. */
export const createValidationContext = (schema: Schema, options?: SchemaValidationOptions) => {
  const errors: SchemaValidationError[] = [];

  const warnings: SchemaValidationError[] = [];

  const { flat, pages, pageFolders, variables, components } = schema;

  const baseElementId = options?.baseElementId;

  // Helper: check if element exists in flat
  const elementExists = (id: string): boolean => !!flat[id];

  // Helper: get element safely
  const getElement = (id: string): Element | undefined => flat[id];

  /**
   * The LAYOUT shells: a `layoutContainer` nobody owns.
   *
   * One of these is a root exactly as a page is. Several pages are rendered *inside* it — they name it in their
   * `layout` attribute rather than containing it — so it hangs off no page, its descendants are rooted on IT, and
   * nothing in it is orphaned. The type alone is not the test: a layoutContainer WITH a parent is an ordinary
   * element of whatever tree owns it.
   */
  const layoutRootIds = (): string[] =>
    Object.values(flat)
      .filter(element => element?.definition?.type === 'layoutContainer' && !element.definition.parentId)
      .map(element => element.id);

  /** Every root of the document: its pages, its layout shells and, for a fragment, the element it hangs off. */
  const rootIds = (): string[] => [
    ...new Set([...pages, ...layoutRootIds(), ...(baseElementId ? [baseElementId] : [])])
  ];

  return {
    schema,
    options,
    errors,
    warnings,
    flat,
    pages,
    pageFolders,
    variables,
    components,
    baseElementId,
    elementExists,
    getElement,
    layoutRootIds,
    rootIds
  };
};

export type ValidationContext = ReturnType<typeof createValidationContext>;
