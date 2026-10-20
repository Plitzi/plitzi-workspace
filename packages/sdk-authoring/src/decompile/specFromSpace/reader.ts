import { splitKeyframesCss } from '../../schema/keyframes';
import { splitNotificationsCss } from '../../schema/notifications';
import { categoryOf, definitionOf, withNamedIds } from '../documents';
import { classesSpec, countSelectorUses, foldStylesheet, indexStyle, readElementDefaults } from './classes';
import {
  collectRoots,
  derivedIds,
  readComponent,
  readFolders,
  readLayout,
  readPage,
  reportDroppedFields,
  reportUnreachable
} from './pages';
import { SETTING_NAMES, bindingCorpus, isEmpty, stepCorpus, tokensOf, correct } from './values';

import type { SpaceDocuments, SpaceSpec } from '../../schema';
import type { SelectorBlocks } from '../styles';
import type { SpecCorrection, SpecFromSpace, SpecFromSpaceOptions } from './types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * One reading of a space: what it has learnt so far, read and written by the functions of this folder — each takes the
 * reader. Never handed out: `specFromSpace` answers with what it read.
 */
export class SpecReader {
  readonly corrections: SpecCorrection[] = [];

  readonly flat: Record<string, Element>;

  /** The elements of every component's tree: closed, so what they read besides their own tree is `props`. */
  readonly componentElements: Set<string>;

  readonly references: Set<string>;

  readonly classBlocks = new Map<string, SelectorBlocks>();

  ancestorNames: Set<string> | undefined;

  readonly elementBlocks = new Map<string, Record<string, SelectorBlocks>>();

  readonly selectorUses = new Map<string, number>();

  /** The element ids authoring would derive on its own, and so the ones an export leaves out (see derivedIds). */
  derived = new Set<string>();

  /** Selectors kept as classes under their own name, rather than written into the one element that uses them. */
  readonly keptClasses = new Set<string>();

  readonly keptCss: string[] = [];

  readonly reachable = new Set<string>();

  readonly pluginTypes: Set<string>;

  readonly folderIds = new Set<string>();

  readonly layoutIds = new Set<string>();

  readonly droppedFields = new Map<string, number>();

  readonly droppedAttributes = new Map<string, number>();

  readonly documents: SpaceDocuments;

  constructor(
    documents: SpaceDocuments,
    readonly options: SpecFromSpaceOptions
  ) {
    const { schema, renames } = withNamedIds(documents.schema);
    for (const { from, to, fromIdRef } of renames) {
      correct(
        this,
        'legacy-element-id',
        fromIdRef
          ? `"${from}" is the key an older builder gave "${to}", whose id is its name now; renamed, and everything that pointed at it.`
          : `"${from}" is not an id anything can name; renamed "${to}", and everything that pointed at it.`,
        to
      );
    }

    this.documents = { ...documents, schema };
    // Every tree at once: ids are one namespace across the pages' tree and each component's, so a lookup by id needs
    // no tree to be named, and what a component's element points at reads the same as a page's.
    this.flat = Object.fromEntries(
      [schema.flat, ...Object.values(schema.components).map(component => component.flat)].flatMap(flat =>
        Object.entries(flat)
      )
    );
    this.componentElements = new Set(
      Object.values(schema.components).flatMap(component => Object.keys(component.flat))
    );
    this.pluginTypes = new Set(options.pluginTypes ?? []);
    this.references = tokensOf(
      JSON.stringify([
        Object.values(this.flat).map(element => [
          element.attributes,
          bindingCorpus(element.definition.bindings),
          stepCorpus(element.id, element.definition.interactions ?? {})
        ]),
        schema.settings,
        schema.variables
      ])
    );
  }

  read(): SpecFromSpace {
    const { schema, style } = this.documents;
    const definition = definitionOf(schema);
    const name = definition.name || this.options.name;
    const permanentUrl = definition.permanentUrl || this.options.permanentUrl;
    if (!name || !permanentUrl) {
      throw new Error(
        'The document names no space (`schema.definition` is empty): pass `name` and `permanentUrl` so the ids it derives are stable.'
      );
    }

    indexStyle(this, style);
    // An older export may carry no stylesheet at all.
    const written: unknown = schema.settings.customCss;
    // The keyframes block and the notifications' rule are authoring's own writing: each goes back to the field it was
    // written from.
    const { keyframes, customCss: withoutKeyframes } = splitKeyframesCss(typeof written === 'string' ? written : '');
    const { notifications, customCss: writtenOwn } = splitNotificationsCss(withoutKeyframes);
    const ownCss = foldStylesheet(this, writtenOwn);
    const pageFolders = readFolders(this);
    const roots = collectRoots(this);
    if (roots.pages.length === 0) {
      throw new Error('The space has no pages, so there is nothing to write out: add one before exporting it as code.');
    }

    countSelectorUses(this, roots);
    this.derived = derivedIds(this, roots);

    const elements = readElementDefaults(this, style.mode);
    const components = roots.components.map(component => readComponent(this, component));
    const layouts = roots.layouts.map(layout => readLayout(this, layout));
    const pages = roots.pages.map((page, index) => readPage(this, page, index));
    reportDroppedFields(this);
    reportUnreachable(this);

    const classes = classesSpec(this, style.mode);
    // `customCss` is read above — what is left of it once the rules a class can hold have moved into their classes.
    // `computed` and `channels` too: a space declares them at its top, where authoring reads them, not in `settings`.
    const { computed, channels, ...settings } = readSettings(
      this,
      Object.fromEntries(Object.entries(schema.settings).filter(([key]) => key !== 'customCss'))
    );
    const customCss = [ownCss, ...this.keptCss].filter(Boolean).join('\n\n');

    const spec: SpaceSpec = {
      name,
      permanentUrl,
      mode: style.mode,
      theme: style.theme,
      ...(isEmpty(style.variables) ? {} : { variables: style.variables }),
      ...(style.fonts && style.fonts.length > 0 ? { fonts: style.fonts } : {}),
      ...(isEmpty(elements) ? {} : { elements }),
      ...(isEmpty(classes) ? {} : { classes }),
      ...(schema.variables.length > 0 ? { schemaVariables: readSchemaVariables(schema.variables) } : {}),
      ...(isEmpty(settings) ? {} : { settings }),
      ...(computed && !isEmpty(computed) ? { computed } : {}),
      ...(schema.flags && !isEmpty(schema.flags) ? { flags: schema.flags } : {}),
      ...(channels && !isEmpty(channels) ? { channels } : {}),
      ...(customCss ? { customCss } : {}),
      ...(isEmpty(keyframes) ? {} : { keyframes }),
      ...(isEmpty(notifications) ? {} : { notifications }),
      ...(schema.rsc ? { rsc: schema.rsc } : {}),
      ...(pageFolders.length > 0 ? { pageFolders } : {}),
      ...(layouts.length > 0 ? { layouts } : {}),
      ...(components.length > 0 ? { components } : {}),
      pages
    };

    return { spec, corrections: this.corrections };
  }
}

/**
 * The settings, without the empty strings the builder writes for one nobody chose — not a value any of them takes
 * — and without a key no setting answers to any more.
 */
const readSettings = (
  reader: SpecReader,
  stored: Record<string, unknown>
): Partial<Omit<Schema['settings'], 'customCss'>> => {
  const kept = Object.entries(stored).filter(([key, value]) => {
    if (!SETTING_NAMES.has(key)) {
      correct(reader, 'dropped-setting', `Dropped the setting "${key}": nothing reads it.`);

      return false;
    }

    return value !== '';
  });

  return Object.fromEntries(kept);
};

/** A variable's category is a label, and a document that has none says so with null where the type wants text. */
const readSchemaVariables = (variables: Schema['variables']): Schema['variables'] => {
  return variables.map(variable => ({ ...variable, category: categoryOf(variable) }));
};

/**
 * Reads a space's documents back into a {@link SpaceSpec}, repairing what can be repaired and reporting each repair.
 *
 * Pass the result to `authorSpace` and the documents that come back are equivalent to the ones read — the same
 * tree, the same rules under the same selectors wherever anything names them, the same bindings and flows — which
 * `compareSpaces` can prove for any particular pair.
 */
export const specFromSpace = (documents: SpaceDocuments, options: SpecFromSpaceOptions = {}): SpecFromSpace =>
  new SpecReader(documents, options).read();
