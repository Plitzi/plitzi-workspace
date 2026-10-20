import { rendersNoTag, RESERVED_PROP_NAMES, parentChain } from '@plitzi/sdk-schema';
import { invalidParams } from '@plitzi/sdk-shared/authoring';
import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { anchorOf } from '@plitzi/sdk-shared/schema';

import { groupBindings, hasVisibilityBinding, bindTemplate, toBindingSpecs, withVisibility } from '../bindings';
import { AuthoringError } from '../codes';
import { flagGateOf } from '../flags';
import { authorFlows } from '../flows';
import { assertBindingShape } from '../guard';
import { instanceSelectorFor, selectorFor } from '../handles';
import { CUSTOM_TYPE } from '../lint/context';
import { MAIN_ATTRIBUTES } from '../mainAttributes';
import { refusalOf } from '../refusals';
import { didYouMean } from '../suggest';
import { writtenAt } from '../writtenAt';
import { assertElementShape, assertFlowShapes, assertQuiet } from './checks';
import { baseSelectorFor, declaredSlots, slotSelectors, variantDeclared, variantOwner } from './styles';
import { REPEATING_TYPES, aboveChildren, placeOf, rowsOf, shownWithOf } from './values';

import type { SpaceAuthor } from './author';
import type { ElementHandle } from '../handles';
import type { BindingsSpec, ElementSpec } from '../types';
import type { Above, AuthorTree } from './values';
import type { DropPosition, Element, Schema } from '@plitzi/sdk-shared';

/** `<type>-<n>` for an element nobody named. Positional and deterministic, so a re-run writes the same document;
 *  it steps over anything the author named so a derived name can never take one. */
export const nextId = (author: SpaceAuthor, type: string): string => {
  let next = (author.idCounters.get(type) ?? 0) + 1;
  while (author.authorNames.has(`${type}-${next}`)) {
    next += 1;
  }

  author.idCounters.set(type, next);

  return `${type}-${next}`;
};

/**
 * A button's `controls` names what it shows and hides by that element's id, as every reference here does; the page
 * needs it by an id the DOM carries — an anchor. The element is given one (its id, when that is one already) and the
 * button names it. A value that already is an anchor of the space is kept as written.
 */
export const resolveControls = (author: SpaceAuthor): void => {
  const { flat } = author.flatMap;
  for (const element of Object.values(flat)) {
    const controls = element.attributes.controls;
    if (element.definition.type !== 'button' || typeof controls !== 'string' || controls === '') {
      continue;
    }

    if (!Object.hasOwn(flat, controls)) {
      if (Object.values(flat).some(other => other.definition.anchor === controls)) {
        continue;
      }

      throw new AuthoringError(
        'controls-unknown',
        `Button "${element.id}" controls "${controls}", which is no element of the space${didYouMean(controls, Object.keys(flat)) || '.'} Name the element it shows and hides by its id: \`controls: 'faq-answer'\`.`
      );
    }

    const target = flat[controls];
    const anchor = target.definition.anchor ?? anchorOf(target.id);
    target.definition.anchor = anchor;
    element.attributes.controls = anchor;

    // Drawn in a list's rows, its anchor is each row's own: the button points at its own row's, and only one of the
    // same rows can — from anywhere else there is no one element it would name.
    const targetRows = rowsOf(flat, target.id);
    if (targetRows.length > 0) {
      if (rowsOf(flat, element.id).join(' ') !== targetRows.join(' ')) {
        throw new AuthoringError(
          'controls-other-row',
          `Button "${element.id}" controls "${target.id}", which the list "${targetRows.join('" in "')}" draws once per row — from outside that row there is no one of them it could name. Put the button in the same row, or have it control an element outside the list.`
        );
      }

      element.attributes.controlsInRow = true;
    }
  }
};

/**
 * Inserts through `FlatMap`, and refuses to carry on when it declines.
 *
 * It answers `false` rather than throwing — a builder dropping an element somewhere it may not go is not an
 * exception — so an ignored return here is an element that never made it into the document while the page it
 * belonged to authors perfectly well. The reason it is nearly always declined is a name two elements share,
 * and a name written twice is worth hearing about at the line that wrote it.
 */
export const insert = (
  author: SpaceAuthor,
  element: Element,
  to: string,
  position: DropPosition,
  path = to,
  tree = author.pagesTree
): void => {
  const earlier = author.authoredAt.get(element.id);
  if (earlier !== undefined) {
    // A page or a layout holding the name is not a helper called twice: `scope()` would not help, a new name does.
    const holder = (tree.map.flat[element.id] as Element | undefined)?.definition.type;
    const root = holder === 'page' ? 'page' : holder === 'layoutContainer' ? 'layout' : undefined;
    // A provider's id is its source's name: `scope()` would rename it, and every template reading it with it.
    const provider = holder === 'apiContainer' && element.definition.type === 'apiContainer';
    throw new AuthoringError(
      'id-taken',
      root
        ? `Element "${element.id}" (${element.definition.type}) at ${path} uses the name of the ${root} at ${earlier} — ids are one namespace for the whole space, pages and layouts included. Give the element a name of its own: \`id: '${element.id}-${element.definition.type.toLowerCase()}'\`.`
        : provider
          ? `Provider "${element.id}" at ${path} is declared again — it is at ${earlier} too. Ids are one namespace for the whole space, and a provider's id is the name its source is read by: put it once in the layout those pages share (\`layouts\`, and \`layout: { id, slot }\` on each page), where every page reads it as it does now — a provider in a layout serves every page.`
          : `Element "${element.id}" (${element.definition.type}) at ${path} uses a name already taken at ${earlier}. Ids are one namespace for the whole space — layouts and every page share it — so wrap the function called more than once in \`scope('<what it is for>', ref => …)\`, which prefixes every id inside it.`
    );
  }

  if (!tree.map.addElement(element, to, position)) {
    throw new AuthoringError(
      'element-rejected',
      `Could not author element "${element.id}" (${element.definition.type}) at ${path}: the schema refused it`
    );
  }

  author.authoredAt.set(element.id, path);
};

/**
 * Files an element under the root it renders in: its page, or the layout shell it belongs to.
 *
 * A layout's elements go under the layout and never under a page, because they render on every page that names
 * it — filed under one, a suite would look for the header only there. An element whose root is neither is dropped
 * rather than filed somewhere plausible: a handle that resolves to the wrong root is worse than one that is absent,
 * which the lookup reports by name.
 */
/**
 * An element whose every child shows only under a condition — four menu panels in one list, each opening on the
 * state that names it — shows nothing on a bare visit either, and that is it working: it is conditional the way its
 * children are. Bottom up, so a wrapper of such an element is too. Without it a suite asserting "everything named
 * is visible" failed on the menu at rest, and the only way past was a condition on the parent that said nothing new.
 *
 * Not an element that chooses its children: its children are conditional because it decides which to show, and it is
 * on screen to decide — a dashboard is there whichever panels it draws.
 */
export const markConditionalByChildren = (author: SpaceAuthor, schema: Schema): void => {
  const handles = [...Object.values(author.handles), ...Object.values(author.layoutHandles)].flatMap(root =>
    Object.values(root.elements)
  );
  const byId = new Map(handles.map(handle => [handle.id, handle]));
  for (let changed = true; changed;) {
    changed = false;
    for (const handle of handles) {
      const element = schema.flat[handle.id];
      const items = handle.conditional || choosesChildren(author, element) ? [] : (element.definition.items ?? []);
      if (items.length > 0 && items.every(child => byId.get(child)?.conditional === true)) {
        handle.conditional = true;
        changed = true;
      }
    }
  }
};

/** The name an element's plugin is declared under: its own type, or `custom:<renderType>` for one a `custom` hosts. */
const pluginKeyOf = (element: Element): string => {
  const { type } = element.definition;
  const renderType = element.attributes.renderType;

  return type === CUSTOM_TYPE && typeof renderType === 'string' ? `${CUSTOM_TYPE}:${renderType}` : type;
};

/** Whether the element's plugin declares it draws nothing. */
const drawsNothing = (author: SpaceAuthor, element: Element): boolean => {
  return author.options.drawsNothingTypes?.includes(pluginKeyOf(element)) ?? false;
};

/** Whether the element's plugin declares it shows only some of its children, chosen as it runs. */
const choosesChildren = (author: SpaceAuthor, element: Element): boolean => {
  return author.options.choosesChildrenTypes?.includes(pluginKeyOf(element)) ?? false;
};

/**
 * What an element is written with that reaches nothing, said: a variant no class and no type style declares — the
 * element looks the same with it or without — and, once per plugin, an attribute it declares under one of the
 * element's own names, which a factory reads as that and never hands to the plugin.
 */
const warnUnreachable = (author: SpaceAuthor, element: Element, spec: ElementSpec, where: string): void => {
  const key = pluginKeyOf(element);
  const reserved = author.options.reservedPluginAttributes?.[key] ?? [];
  if (reserved.length > 0 && !author.reservedWarned.has(key)) {
    author.reservedWarned.add(key);
    author.styleWarnings.push({
      code: 'plugin-attribute-reserved',
      message: `${where} is a "${key}", whose plugin declares ${reserved.map(name => `\`${name}\``).join(', ')} — ${reserved.length === 1 ? 'a name' : 'names'} authoring reads as the element's own (\`variant\` is its style variant, \`class\` its classes), so the plugin is never handed ${reserved.length === 1 ? 'it' : 'them'}. Rename ${reserved.length === 1 ? 'it' : 'them'} in the plugin: \`variant\` → \`kind\`.`,
      elementId: element.id
    });
  }

  if (spec.variant === undefined || variantDeclared(author, spec, spec.variant)) {
    return;
  }

  const plugin = reserved.includes('variant')
    ? ' If it was meant for the plugin’s own `variant`, that attribute is never set: rename it in the plugin.'
    : element.definition.type === CUSTOM_TYPE
      ? ' On a `custom` element `variant` is its style variant, never a prop of the component it hosts: hand the component a prop of another name (`tone`).'
      : '';
  author.styleWarnings.push({
    code: 'unknown-variant',
    message: `${where} is written with \`variant: '${spec.variant}'\`, which no class of it and no style of its type declares, so nothing applies.${plugin} Declare it — \`styles(name, { variants: { ${spec.variant}: { … } } })\` — or name one that is.`,
    elementId: element.id
  });
};

const recordHandle = (author: SpaceAuthor, handle: ElementHandle): void => {
  // `hasOwn` rather than a falsy check: an index signature types every read as a hit, so this is the only way to
  // ask whether a root has an entry at all.
  if (Object.hasOwn(author.handles, handle.pageId)) {
    author.handles[handle.pageId].elements[handle.id] = handle;

    return;
  }

  if (Object.hasOwn(author.layoutHandles, handle.pageId)) {
    author.layoutHandles[handle.pageId].elements[handle.id] = handle;
  }
};

/**
 * An element and everything under it, into `tree` — or, when it cannot be written, the reason kept for the end, so a
 * run reports every element that is wrong rather than the first. Its subtree is skipped; its siblings are not.
 */
export const addElement = (
  author: SpaceAuthor,
  spec: ElementSpec,
  path: string,
  place: string,
  rootId: string,
  parentId: string,
  above: Above = 'shown',
  tree = author.pagesTree
): string => {
  try {
    return writeElement(author, spec, path, place, rootId, parentId, above, tree);
  } catch (error) {
    author.skipped += 1;
    author.refusals.push({ place, at: writtenAt(spec), ...refusalOf(error) });

    return typeof spec.id === 'string' ? spec.id : '';
  }
};

/**
 * The element's bindings with `from` among them: its main attribute bound to the source, through a template when `as`
 * names one — a format of the space's, or a template of its own. The same binding `bind` writes, said shorter.
 */
const boundFrom = (author: SpaceAuthor, spec: ElementSpec, where: string): BindingsSpec | undefined => {
  if (spec.from === undefined) {
    if (spec.as !== undefined) {
      throw new AuthoringError(
        'as-without-from',
        `${where} says \`as: '${spec.as}'\` with no \`from\`: \`as\` is how the source \`from\` names is shown.`
      );
    }

    return spec.bind;
  }

  const main = Object.hasOwn(MAIN_ATTRIBUTES, spec.type) ? MAIN_ATTRIBUTES[spec.type] : undefined;
  if (!main) {
    throw new AuthoringError(
      'from-without-attribute',
      `${where} has \`from\`, but a "${spec.type}" has no one attribute that shows its data. Bind the attribute you mean: \`bind: { attribute: '${spec.from}' }\`.`
    );
  }

  const bound = spec.bind === undefined ? [] : toBindingSpecs(spec.bind);
  if (bound.some(binding => binding.to === main && (binding.category ?? 'attributes') === 'attributes')) {
    throw new AuthoringError(
      'from-and-bind',
      `${where} binds "${main}" twice — with \`from\` and in \`bind\`. Keep \`from\`, and give \`bind\` the other attributes.`
    );
  }

  const template = spec.as === undefined ? undefined : templateFor(author, spec.as, where);

  return [
    ...bound,
    template === undefined
      ? { to: main, source: spec.from }
      : bindTemplate(main, spec.from, template, main === 'items' ? { returns: 'value' } : {})
  ];
};

/** What a format's name looks like: `price`, `shortDate` — anything else written in `as` is words or a template. */
const FORMAT_NAME = /^[A-Za-z_$][\w$-]*$/;

/** A format by its name in the space's `formats`, or the template written in its place. */
const templateFor = (author: SpaceAuthor, as: string, where: string): string => {
  if (hasTemplateSyntax(as)) {
    return as;
  }

  const formats = author.spec.formats ?? {};
  // Words, not a name: what an element always shows is its content — `as` shows the data `from` names.
  if (!FORMAT_NAME.test(as) && !Object.hasOwn(formats, as)) {
    throw new AuthoringError(
      'format-unknown',
      `${where} says \`as: '${as}'\`, which is words, not a format: \`as\` names a format of the space's \`formats\` (\`as: 'price'\`) or is a template that shows the data \`from\` names (\`as: '{{ source }} kg'\`). Words the element always shows are its content — \`content: '${as}'\`, with no \`from\`.`
    );
  }

  if (!Object.hasOwn(formats, as) || typeof formats[as] !== 'string') {
    throw new AuthoringError(
      'format-unknown',
      `${where} shows its data \`as: '${as}'\`, which the space's \`formats\` do not name${didYouMean(as, Object.keys(formats)) || '.'} Declare it once — \`formats: { ${as}: "{{ source|currency('USD') }}" }\` — or write the template in its place.`
    );
  }

  return formats[as];
};

/**
 * `path` is where its parent placed it; its identity — what a selector of its own and its bindings are named after —
 * is that place with its id in its position, so it never changes when its siblings move. `place` is how a person
 * finds it: the nearest named element, and the steps from there.
 */
const writeElement = (
  author: SpaceAuthor,
  spec: ElementSpec,
  path: string,
  place: string,
  rootId: string,
  parentId: string,
  above: Above,
  tree: AuthorTree
): string => {
  assertElementShape(spec, place);
  const id = spec.id ?? nextId(author, spec.type);
  // Named by its id, written or given, where its parent placed it by position: an element and everything it holds
  // keep the selectors and binding ids their rules are named after wherever its siblings are moved.
  const identity = `${path.slice(0, path.lastIndexOf('/'))}/#${id}`;
  author.specs.set(id, spec);
  const where = `Element "${spec.type}" (${id}) at ${place}`;
  assertFlowShapes(spec.flows, where);
  if (spec.type === 'reference' && spec.attributes?.referenceType === 'component') {
    assertInstance(author, spec, where);
  }

  if (spec.quiet !== undefined) {
    assertQuiet(spec.quiet, where);
  }

  const isRoot = parentId === '';
  const ownRootId = isRoot ? id : rootId;
  const bindings = withVisibility({ bind: boundFrom(author, spec, where), visible: spec.visible });
  const ownCondition = spec.visible !== undefined || hasVisibilityBinding(bindings);
  const conditional = above !== 'shown' || ownCondition;
  const shownWith = ownCondition ? undefined : shownWithOf(above, id);
  const ancestors = ancestorsOf(parentId, tree.map.flat);
  bindings?.forEach(binding => assertBindingShape(binding, where));
  const sourceIndex = author.options.sourceTypes ? tree.sources : undefined;

  const element: Element = {
    id,
    attributes: spec.attributes ?? {},
    definition: {
      label: spec.meta?.label ?? spec.type,
      type: spec.type,
      rootId: ownRootId,
      ...(isRoot ? {} : { parentId }),
      items: [],
      // A slot names a class outright: it dresses a part of an element that already exists, and a selector of
      // its own per control would write the same rule once per input on the page.
      styleSelectors: {
        base: baseSelectorFor(author, identity, id, spec, place),
        ...declaredSlots(author, spec.type),
        ...slotSelectors(author, spec, place)
      },
      initialState: {
        /**
         * An element with a CONDITION starts hidden, and one without starts on screen.
         *
         * "Visible when X" plainly means "not otherwise", and the binding cannot say so on its own: a source
         * that resolves to nothing writes nothing, and an absent `visibility` is read as visible. So a panel
         * waiting on a selection nobody has made yet, or on any state that only exists once the page is live,
         * was authored on screen with placeholder text in it until something happened.
         *
         * A visibility binding written by hand keeps its element on screen until it answers, as it always has —
         * spaces rely on that (a sidebar's logo bound to a state nobody sets until the sidebar is folded). A
         * computed one that should wait for its data says so with \`visible: false\`; see
         * \`warnConditionStartsVisible\`.
         */
        visibility: spec.visible === undefined,
        ...(spec.variant
          ? { styleVariant: { [variantOwner(author, spec, spec.variant)]: { base: spec.variant } } }
          : {})
      },
      ...(spec.runtime ? { runtime: spec.runtime } : {}),
      ...(spec.loadStrategy ? { loadStrategy: spec.loadStrategy } : {}),
      ...(spec.anchor === undefined ? {} : { anchor: spec.anchor }),
      ...(spec.motion === undefined ? {} : { motion: spec.motion }),
      // In the document, not only here: the builder and the MCP are offered the suggestions `suggestSpace` makes
      // from the document, and leave out the same ones.
      ...(spec.quiet === undefined ? {} : { quiet: [...spec.quiet] }),
      ...(spec.flag === undefined ? {} : { flag: flagGateOf(spec.flag, where) }),
      ...(bindings?.length ? { bindings: groupBindings(identity, bindings, sourceIndex, where, tree.globals) } : {}),
      ...(spec.flows ? { interactions: authorFlows(spec.flows, id) } : {})
    }
  };

  insert(author, element, parentId, isRoot ? 'custom' : 'inside', place, tree);
  warnUnreachable(author, element, spec, where);

  recordHandle(author, {
    id,
    type: spec.type,
    pageId: rootId,
    selector:
      element.definition.type === 'reference' && element.attributes.referenceType === 'component'
        ? instanceSelectorFor(id)
        : selectorFor(id),
    named: spec.id !== undefined,
    ...(conditional ? { conditional: true } : {}),
    ...(shownWith === undefined ? {} : { shownWith }),
    ...([...ancestors].some(ancestor => REPEATING_TYPES.has(tree.map.flat[ancestor].definition.type))
      ? { repeated: true }
      : {}),
    ...(rendersNoTag(element) || drawsNothing(author, element) ? { boxless: true } : {})
  });

  const children = spec.row === undefined ? spec.children : rowChildren(author, spec, spec.row, id, where);
  // Under an element that chooses which of them to show, every one is shown under a condition only it knows.
  const childrenAbove = aboveChildren(conditional, shownWith, choosesChildren(author, element));
  children?.forEach((child, index) =>
    addElement(author, child, `${identity}/${index}`, placeOf(child, place, index), ownRootId, id, childrenAbove, tree)
  );

  return id;
};

/** A `row` placed: a list's IS its children; a carousel's goes in a track, beside the controls it was given. */
const rowChildren = (author: SpaceAuthor, spec: ElementSpec, row: string, id: string, where: string): ElementSpec[] => {
  const instance = rowInstance(author, row, id, where);
  if (spec.type !== 'carousel') {
    return [instance];
  }

  return [
    { type: 'carouselTrack', attributes: {}, children: [instance], meta: { label: 'Carousel Track' } },
    ...(spec.children ?? [])
  ];
};

/**
 * A list's `row` that names a component: that component, once per item, with the row bound to the prop that takes
 * it — `item`, or the component's only prop. The instance `component()` writes, written here because only the space
 * knows the component's props.
 */
const rowInstance = (author: SpaceAuthor, componentId: string, listId: string, where: string): ElementSpec => {
  const target = author.spec.components?.find(candidate => candidate.id === componentId);
  const props = Object.keys(target?.props ?? {});
  const prop = props.includes('item') ? 'item' : props.length === 1 ? props[0] : undefined;
  if (!target || !prop) {
    throw new AuthoringError(
      'row-component',
      target
        ? `${where} places component "${componentId}" per row, which has ${props.length === 0 ? 'no props' : `the props ${props.join(', ')} and none called "item"`} to take the row. Give it an \`item\` prop, or write the row as a function.`
        : `${where} places component "${componentId}" per row, which this space does not declare${
            didYouMean(
              componentId,
              (author.spec.components ?? []).map(candidate => candidate.id)
            ) || '.'
          }`
    );
  }

  return {
    type: 'reference',
    attributes: { referenceType: 'component', referenceId: componentId },
    bind: [{ to: prop, source: `${listId}.item` }],
    meta: { label: 'Reference' }
  };
};

/** The element about to be placed under `parentId`, and everything that one is nested in. */
export const ancestorsOf = (parentId: string, flat: Schema['flat']): Set<string> => {
  return Object.hasOwn(flat, parentId) ? new Set([parentId, ...parentChain(flat, parentId)]) : new Set();
};

/**
 * An instance against the component it places, before it is written: the component exists, every prop it hands in
 * is declared and of the declared kind, none it requires is missing, and every child fills a slot it has.
 */
export const assertInstance = (author: SpaceAuthor, spec: ElementSpec, where: string): void => {
  const declared = author.spec.components ?? [];
  const componentId = spec.attributes?.referenceId;
  const target = declared.find(candidate => candidate.id === componentId);
  if (!target) {
    throw new AuthoringError(
      'component-undeclared',
      `${where} places component "${String(componentId)}", which this space does not declare${
        typeof componentId === 'string'
          ? didYouMean(
              componentId,
              declared.map(candidate => candidate.id)
            ) || '.'
          : '.'
      } Declare it in \`components\`.`
    );
  }

  const props = target.props ?? {};
  const names = Object.keys(props);
  const given = Object.fromEntries(
    // What the instance answers to as an element — which component it is, the slot it sits in — is not a prop.
    Object.entries(spec.attributes ?? {}).filter(([name]) => !RESERVED_PROP_NAMES.has(name))
  );
  for (const name of Object.keys(given)) {
    if (!names.includes(name)) {
      throw new AuthoringError(
        'prop-unknown',
        `${where} hands component "${target.id}" "${name}", which it does not declare${didYouMean(name, names) || '.'} It declares ${names.length > 0 ? names.join(', ') : 'no props'}.`
      );
    }
  }

  const bound = new Set(spec.bind === undefined ? [] : toBindingSpecs(spec.bind).map(binding => binding.to));
  for (const [name, prop] of Object.entries(props)) {
    if (prop.required && given[name] === undefined && !bound.has(name)) {
      throw new AuthoringError(
        'prop-missing',
        `${where} places component "${target.id}" without "${name}", which it requires${prop.description ? ` — ${prop.description}` : ''}. Hand it in: \`component('${target.id}', { props: { ${name}: … } })\`, or bind it.`
      );
    }
  }

  const invalid = invalidParams(given, given, props).at(0);
  if (invalid) {
    throw new AuthoringError(
      'prop-value',
      `${where} hands component "${target.id}" "${invalid.key}" as ${invalid.got}, and it is declared ${invalid.expected}${invalid.options ? ` — one of ${invalid.options.map(option => `'${option}'`).join(', ')}` : ''}.`
    );
  }

  const slots = target.slots ?? [];
  for (const child of spec.children ?? []) {
    const named = child.attributes?.slot;
    const slot = typeof named === 'string' ? named : slots.length === 1 ? slots[0] : undefined;
    if (slot === undefined || !slots.includes(slot)) {
      throw new AuthoringError(
        'slot-children',
        `${where} puts a "${child.type}" in ${slot === undefined ? 'no slot' : `the slot "${slot}"`}, but component "${target.id}" declares ${slots.length > 0 ? `the slots ${slots.map(name => `"${name}"`).join(', ')} — hand children in by slot: \`children: { '${slots[0]}': [ … ] }\`` : 'no slots, so an instance of it takes no children'}.`
      );
    }
  }
};
