import { isDocumentScroll } from '@plitzi/sdk-elements/elements/declarations';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { isOgType, pageAccessOf } from '@plitzi/sdk-shared/schema';

import { readBindings, readFlows } from './bindings';
import { baseStyle, pageStyle } from './classes';
import { readElement } from './elements';
import { componentRoots, childrenOf, dropField } from './tree';
import {
  BINDING_CATEGORIES,
  LAYOUT_ATTRIBUTES,
  LEGACY_ELEMENT_TYPES,
  PAGE_ATTRIBUTES,
  bindingsOf,
  isEmpty,
  correct
} from './values';
import { flagSpecOf } from '../../schema/flags';

import type { SpecReader } from './reader';
import type { Roots } from './types';
import type { ComponentSpec, LayoutRef, LayoutSpec, PageFolderSpec, PageSpec } from '../../schema';
import type { Element, SpaceComponent } from '@plitzi/sdk-shared';

/**
 * The element ids authoring would derive by itself — exactly those, which is what lets an export leave them out.
 *
 * Looking like one is not enough. `container-117` has the shape of a derived id, but authoring numbers `<type>-<n>`
 * by position, per type, stepping over every name written out anywhere — so an id that is not the one its position
 * would get is a name the author chose, and dropping it renames the element. Walked in authoring's own order
 * (components, then layouts, then pages, parents before their children). Keeping one id changes what the others would be, since
 * authoring steps over it, so the pass repeats until nothing more has to be kept; it only ever keeps more, so it ends.
 */
export const derivedIds = (reader: SpecReader, roots: Roots): Set<string> => {
  const order: Element[] = [];
  const visit = (element: Element): void => {
    order.push(element);
    childrenOf(reader, element, false).forEach(visit);
  };
  // A component's root is an element like any other — authoring derives its name when none was written — and the
  // components are written first.
  componentRoots(roots).forEach(visit);
  [...roots.layouts, ...roots.pages].forEach(root => childrenOf(reader, root, false).forEach(visit));

  const authoredType = ({ definition: { type } }: Element): string =>
    Object.hasOwn(LEGACY_ELEMENT_TYPES, type) ? LEGACY_ELEMENT_TYPES[type].type : type;
  const named = new Set<string>([...roots.layouts, ...roots.pages].map(root => root.id));
  for (const element of order) {
    if (reader.references.has(element.id)) {
      named.add(element.id);
    }
  }

  for (;;) {
    const counters = new Map<string, number>();
    const derived = new Set<string>();
    let kept = false;
    for (const element of order) {
      if (named.has(element.id)) {
        continue;
      }

      const type = authoredType(element);
      let next = (counters.get(type) ?? 0) + 1;
      while (named.has(`${type}-${next}`)) {
        next += 1;
      }

      counters.set(type, next);
      if (element.id === `${type}-${next}`) {
        derived.add(element.id);
      } else {
        named.add(element.id);
        kept = true;
      }
    }

    if (!kept) {
      return derived;
    }
  }
};

// ---------------------------------------------------------------- tree
export const collectRoots = (reader: SpecReader): Roots => {
  const { schema } = reader.documents;
  const pages = schema.pages.flatMap(id => {
    const page = reader.flat[id] as Element | undefined;
    if (!page) {
      correct(reader, 'missing-element', `The page list names "${id}", which the document does not hold.`, id);

      return [];
    }

    return [page];
  });

  const pageIds = new Set(schema.pages);
  const layouts = Object.values(reader.flat).filter(
    element => !pageIds.has(element.id) && !element.definition.parentId && element.definition.type === 'layoutContainer'
  );
  layouts.forEach(layout => reader.layoutIds.add(layout.id));

  return { pages, layouts, components: Object.values(schema.components) };
};

export const readComponent = (reader: SpecReader, component: SpaceComponent): ComponentSpec => {
  const root = Object.hasOwn(component.flat, component.rootId) ? component.flat[component.rootId] : undefined;
  if (!root) {
    throw new Error(
      `Component "${component.id}" is rooted at "${component.rootId}", which its tree does not hold — there is nothing to write out.`
    );
  }

  return {
    id: component.id,
    ...(component.label ? { label: component.label } : {}),
    ...(component.folder ? { folder: component.folder } : {}),
    ...(component.props && !isEmpty(component.props) ? { props: component.props } : {}),
    ...(component.slots && component.slots.length > 0 ? { slots: component.slots } : {}),
    root: readElement(reader, root)
  };
};

export const readFolders = (reader: SpecReader): PageFolderSpec[] => {
  const folders = reader.documents.schema.pageFolders;
  folders.forEach(folder => reader.folderIds.add(folder.id));

  return folders.map(folder => ({
    id: folder.id,
    ...(folder.name && folder.name !== folder.id ? { name: folder.name } : {}),
    ...(folder.slug !== folder.id ? { slug: folder.slug } : {}),
    ...(folder.parentId && reader.folderIds.has(folder.parentId) ? { parent: folder.parentId } : {})
  }));
};

const folderOf = (reader: SpecReader, value: unknown, owner: string): string | undefined => {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  if (!reader.folderIds.has(value)) {
    correct(
      reader,
      'missing-folder',
      `${owner} was filed in folder "${value}", which the space does not declare.`,
      owner
    );

    return undefined;
  }

  return value;
};

const layoutRefOf = (reader: SpecReader, attributes: Record<string, unknown>, owner: string): LayoutRef | undefined => {
  const { layout, layoutContainer } = attributes;
  if (typeof layout !== 'string' || !layout) {
    return undefined;
  }

  const slot = typeof layoutContainer === 'string' ? (reader.flat[layoutContainer] as Element | undefined) : undefined;
  if (!reader.layoutIds.has(layout) || !slot || slot.definition.rootId !== layout) {
    correct(
      reader,
      'broken-layout',
      `${owner} named the layout "${layout}" with slot "${String(layoutContainer)}", which is not an element of that layout; the page renders without it.`,
      owner
    );

    return undefined;
  }

  return { id: layout, slot: slot.id };
};

export const readLayout = (reader: SpecReader, layout: Element): LayoutSpec => {
  reader.reachable.add(layout.id);
  const where = `Layout "${layout.id}"`;
  const attributes = Object.fromEntries(
    Object.entries(layout.attributes).filter(
      ([key, value]) => !LAYOUT_ATTRIBUTES.has(key) && !(key === 'subType' && value === 'div')
    )
  );
  const folder = folderOf(reader, layout.attributes.folder, where);
  const shell = layoutRefOf(reader, layout.attributes, where);
  const bind = readBindings(reader, layout);

  return {
    id: layout.id,
    ...(layout.definition.label && layout.definition.label !== 'Layout Container'
      ? { label: layout.definition.label }
      : {}),
    ...(folder ? { folder } : {}),
    ...(shell ? { layout: shell } : {}),
    ...(isEmpty(attributes) ? {} : { attributes }),
    ...baseStyle(reader, layout.definition.styleSelectors.base, 'css-and-states'),
    ...(bind.bind ? { bind: bind.bind } : {}),
    ...readFlows(reader, layout),
    body: childrenOf(reader, layout).map(child => readElement(reader, child))
  };
};

export const readPage = (reader: SpecReader, page: Element, index: number): PageSpec => {
  reader.reachable.add(page.id);
  const attributes: Record<string, unknown> = isRecord(page.attributes) ? page.attributes : {};
  const where = `Page "${page.id}"`;
  for (const key of Object.keys(attributes)) {
    if (!PAGE_ATTRIBUTES.has(key)) {
      dropField(reader, `page attribute "${key}"`);
    }
  }

  if (attributes.enabled === false) {
    correct(
      reader,
      'dropped-field',
      `${where} was disabled, which an authored page cannot say; it is authored enabled.`,
      page.id
    );
  }

  const isDefault = attributes.default === true;
  const folder = folderOf(reader, attributes.folder, where);
  const layout = layoutRefOf(reader, attributes, where);
  const accessLevel =
    attributes.accessLevel === 'public' || attributes.accessLevel === 'authenticated'
      ? attributes.accessLevel
      : undefined;
  // The permissions a page is kept for, read as the server reads them: written back, or the export would publish it
  // open.
  const access = pageAccessOf(attributes);
  const redirect =
    attributes.unauthorizedBehaviour === 'redirect' && typeof attributes.unauthorizedPageRedirect === 'string'
      ? attributes.unauthorizedPageRedirect
      : undefined;
  const seoTitle = typeof attributes.seoPageTitle === 'string' ? attributes.seoPageTitle : '';
  const seoDescription = typeof attributes.seoPageDescription === 'string' ? attributes.seoPageDescription : '';
  const robots = typeof attributes.seoRobots === 'string' ? attributes.seoRobots : '';
  const structuredData = Array.isArray(attributes.seoStructuredData)
    ? attributes.seoStructuredData.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const seoImage = typeof attributes.seoImage === 'string' ? attributes.seoImage : '';
  const seoImageAlt = typeof attributes.seoImageAlt === 'string' ? attributes.seoImageAlt : '';
  const seoType = isOgType(attributes.seoType) ? attributes.seoType : undefined;
  const notFound = typeof attributes.notFound === 'string' ? attributes.notFound : '';
  const documentScroll = isDocumentScroll(attributes.documentScroll) ? attributes.documentScroll : undefined;
  if (!documentScroll && attributes.documentScroll !== undefined && attributes.documentScroll !== '') {
    correct(
      reader,
      'dropped-field',
      `${where} had \`documentScroll\` ${JSON.stringify(attributes.documentScroll)}, which no page reads; it is authored scrolling as any page does.`,
      page.id
    );
  }

  if (BINDING_CATEGORIES.some(category => bindingsOf(page.definition.bindings, category).length > 0)) {
    correct(reader, 'dropped-field', `${where} had bindings of its own, which a page cannot declare.`, page.id);
  }

  return {
    id: page.id,
    name: typeof attributes.name === 'string' ? attributes.name : page.id,
    slug: typeof attributes.slug === 'string' ? attributes.slug : '',
    ...(isDefault ? { isDefault: true } : index === 0 ? { isDefault: false } : {}),
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(robots ? { robots } : {}),
    ...(structuredData.length > 0
      ? { structuredData: structuredData.length === 1 ? structuredData[0] : structuredData }
      : {}),
    ...(seoImage ? { seoImage } : {}),
    ...(seoImage && seoImageAlt ? { seoImageAlt } : {}),
    ...(seoType ? { seoType } : {}),
    ...(notFound ? { notFound } : {}),
    ...(documentScroll ? { documentScroll } : {}),
    ...(folder ? { folder } : {}),
    ...(layout ? { layout } : {}),
    ...(accessLevel ? { accessLevel } : {}),
    ...(access ? { access } : {}),
    ...(redirect ? { unauthorizedRedirect: redirect } : {}),
    ...pageStyle(reader, page.definition.styleSelectors.base),
    ...readFlows(reader, page),
    ...(page.definition.flag ? { flag: flagSpecOf(page.definition.flag) } : {}),
    body: childrenOf(reader, page).map(child => readElement(reader, child))
  };
};

export const reportDroppedFields = (reader: SpecReader): void => {
  for (const [field, count] of reader.droppedFields) {
    correct(
      reader,
      'dropped-field',
      `Dropped ${field} on ${count} element${count === 1 ? '' : 's'}: nothing reads it.`
    );
  }

  for (const [attribute, count] of reader.droppedAttributes) {
    correct(
      reader,
      'dropped-attribute',
      `Dropped the attribute ${attribute} on ${count} element${count === 1 ? '' : 's'}: the element does not read it.`
    );
  }
};

export const reportUnreachable = (reader: SpecReader): void => {
  const unreachable = Object.keys(reader.flat).filter(id => !reader.reachable.has(id));
  if (unreachable.length > 0) {
    correct(
      reader,
      'unreachable-element',
      `Dropped ${unreachable.length} element${unreachable.length === 1 ? '' : 's'} no page or layout contains: ${unreachable.join(', ')}.`
    );
  }
};
