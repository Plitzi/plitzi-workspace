import { parentChain, renderContext } from '@plitzi/sdk-schema/helpers/elementTree';
import { getSlugParams } from '@plitzi/sdk-shared/navigation';

import type { AuthorSpaceOptions } from '../types';
import type { SchemaValidationError } from '@plitzi/sdk-schema/helpers/schemaValidator';
import type { Element, Schema, Style } from '@plitzi/sdk-shared';

/**
 * What the linter reads besides the documents: the vocabularies the elements, the interactions and the transformers
 * declare — the same catalogues `authorSpace` takes, documented there. Each is optional, and a check that needs one it
 * was not given is skipped: a document read with no catalogue is held only to what it can prove on its own.
 */
export type LintCatalogs = AuthorSpaceOptions;

export type LintIssue = SchemaValidationError;

/** An attribute read as text: a document stores what an editor wrote, which is not always the string a type says. */
export const textOf = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

/**
 * One reading of a space, shared by every rule: who is where, who publishes what, and the words to name them with.
 *
 * Built once per lint. Rules push into `errors` — what renders something other than what was written — and `warnings`
 * — what renders, and probably not as meant.
 */
export class LintContext {
  readonly errors: LintIssue[] = [];
  readonly warnings: LintIssue[] = [];

  readonly flat: Schema['flat'];
  readonly pageIds: ReadonlySet<string>;
  /** Layout shells: roots that are not pages. */
  readonly layoutIds: ReadonlySet<string>;
  /** Every element that publishes a source, by id, and the prefix it publishes it under. */
  readonly sources: ReadonlyMap<string, string>;
  readonly variables: ReadonlySet<string>;
  /** The space's computed values, in the order they are declared. */
  readonly computed: readonly string[];

  constructor(
    readonly schema: Schema,
    readonly style: Style,
    readonly catalogs: LintCatalogs
  ) {
    this.flat = schema.flat;
    this.pageIds = new Set(schema.pages);
    this.layoutIds = new Set(
      Object.values(schema.flat)
        .filter(element => !element.definition.parentId && element.definition.type === 'layoutContainer')
        .map(element => element.id)
        .filter(id => !this.pageIds.has(id))
    );
    const sourceTypes = catalogs.sourceTypes ?? {};
    this.sources = new Map(
      Object.values(schema.flat)
        .filter(element => Object.hasOwn(sourceTypes, element.definition.type))
        .map(element => [element.id, sourceTypes[element.definition.type]])
    );
    this.variables = new Set(schema.variables.map(variable => variable.name));
    this.computed = Object.keys(schema.settings.computed ?? {});
  }

  error(code: string, message: string, elementId?: string): void {
    this.errors.push({ code, message, ...(elementId === undefined ? {} : { elementId }) });
  }

  warn(code: string, message: string, elementId?: string, details?: Record<string, unknown>): void {
    this.warnings.push({
      code,
      message,
      ...(elementId === undefined ? {} : { elementId }),
      ...(details ? { details } : {})
    });
  }

  element(id: string): Element | undefined {
    return Object.hasOwn(this.flat, id) ? this.flat[id] : undefined;
  }

  /** The attributes a type reads, or null where that is open: a plugin, or a `custom` whose component decides. */
  attributeNames(type: string): readonly string[] | null {
    const { attributeNames } = this.catalogs;

    return attributeNames && Object.hasOwn(attributeNames, type) ? attributeNames[type] : null;
  }

  /** How a message names an element: its type and id, and the page or layout it is on. */
  describe(id: string): string {
    const element = this.element(id);
    if (!element) {
      return `"${id}"`;
    }

    if (this.pageIds.has(id)) {
      return `Page "${textOf(element.attributes.name, id)}"`;
    }

    if (this.layoutIds.has(id)) {
      return `Layout "${id}"`;
    }

    const rootId = element.definition.rootId;
    const root = this.element(rootId);
    const place = this.pageIds.has(rootId)
      ? ` on page "${textOf(root?.attributes.name, rootId)}"`
      : this.layoutIds.has(rootId)
        ? ` in layout "${rootId}"`
        : '';

    return `Element "${element.definition.type}" (${id})${place}`;
  }

  /** The elements `id` is nested in, as the document stores them — what "inside a form" means. */
  ancestors(id: string): Set<string> {
    return new Set(parentChain(this.flat, id));
  }

  /**
   * The elements whose sources `id` can read: everything it renders inside, the layout shells around its page included
   * — the walk the runtime makes, so a provider beside the slot in a layout is not in it.
   */
  scope(id: string): Set<string> {
    return new Set(renderContext(this.flat, id));
  }

  /** The route params an element's page declares; a layout renders on every page, so it sees all of them. */
  routeParams(id: string): string[] {
    const rootId = this.element(id)?.definition.rootId ?? id;
    const slugOf = (pageId: string): string => textOf(this.element(pageId)?.attributes.slug);
    if (this.pageIds.has(rootId)) {
      return getSlugParams(slugOf(rootId));
    }

    return [...new Set([...this.pageIds].flatMap(pageId => getSlugParams(slugOf(pageId))))];
  }
}
