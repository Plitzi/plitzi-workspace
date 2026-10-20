import { parseSpaceFont, isParentAncestor } from '@plitzi/sdk-shared/style';

import {
  BREAKPOINTS,
  classNames,
  classRefs,
  isClassRef,
  modifierClassName,
  sameBlocks,
  splitClassList,
  toBlocks
} from '../../style';
import { AuthoringError } from '../codes';
import { digest } from '../ids';
import { didYouMean } from '../suggest';
import { writtenAt } from '../writtenAt';
import { declaredAt, withCache } from './values';

import type { SpaceAuthor } from './author';
import type {
  ClassList,
  CssSpec,
  ElementClassList,
  ResponsiveBlock,
  StatesSpec,
  StyleDeclaration,
  StyleSpec
} from '../../style';
import type { ElementSpec, ElementStyleSpec } from '../types';
import type { SpaceFont } from '@plitzi/sdk-shared';

/**
 * Whose vocabulary `variant` names: the element type's, unless a class the element wears declares that variant and
 * the type does not. The variant map is keyed by selector, and the class is the selector those rules live on — keyed
 * by the type, `avatar--violet` was never worn and the element rendered as if no variant had been asked for.
 */
export const variantOwner = (author: SpaceAuthor, spec: ElementSpec, variant: string): string => {
  if (author.spec.elements?.[spec.type]?.variants?.[variant] !== undefined || spec.class === undefined) {
    return spec.type;
  }

  const owner = classNames(splitClassList(spec.class).refs).find(name =>
    Object.values(author.classRules.get(name) ?? {}).some(block => block.variants?.[variant] !== undefined)
  );

  return owner ?? spec.type;
};

export const writeElementDefaults = (author: SpaceAuthor, type: string, spec: ElementStyleSpec): void => {
  const base = toBlocks({
    css: spec.base ?? {},
    states: spec.states,
    variants: spec.variants,
    ancestors: spec.ancestors,
    pseudos: spec.pseudos,
    conditions: spec.conditions
  });
  const slots = Object.entries(spec.slots ?? {}).map(([slot, rules]) => [slot, toBlocks(rules)] as const);

  for (const breakpoint of BREAKPOINTS) {
    const slotBlocks = slots.flatMap(([slot, blocks]) => {
      const block = blocks[breakpoint];

      return block ? [[slot, block] as const] : [];
    });

    // Desktop always, as the builder does: an element type the space dresses has an entry even when its base is
    // empty and only a slot says anything.
    if (breakpoint !== 'desktop' && !base[breakpoint] && slotBlocks.length === 0) {
      continue;
    }

    author.platform[breakpoint][type] = withCache({
      name: type,
      type: 'element',
      componentType: type,
      attributes: { base: base[breakpoint] ?? { default: {} }, ...Object.fromEntries(slotBlocks) }
    });
  }
};

/**
 * Adds a class to the space's stylesheet, or agrees it is already there.
 *
 * A `styles()` declaration is normally named in many places and often reached from more than one module, so
 * arriving twice is the ordinary case and not an error. Arriving twice saying DIFFERENT things is: a class name
 * that means one thing on one page and another somewhere else is a rule that silently depends on which file the
 * bundler reached first, which is the shape of bug this whole surface exists to make impossible.
 *
 * `origin` says where, and is only asked for when there is a conflict to report: reading where an element was written
 * means formatting a stack, which every element of every space would otherwise pay for on every write.
 */
export const declareClass = (
  author: SpaceAuthor,
  name: string,
  blocks: ResponsiveBlock,
  origin: () => string,
  written: () => string,
  declaration?: StyleDeclaration
): void => {
  const existing = author.classRules.get(name);
  if (!existing) {
    author.classRules.set(name, blocks);
    author.classOrigins.set(name, origin);
    author.classWritten.set(name, written);
    if (declaration) {
      author.classDeclarations.set(name, declaration);
    }

    return;
  }

  if (!sameBlocks(existing, blocks)) {
    throw new AuthoringError(
      'class-conflict',
      `The class "${name}" is declared twice with different rules: ${author.classOrigins.get(name)?.() ?? 'once before'}, and ${origin()}. A class is one rule set per space: rename one of them, or make them agree.`
    );
  }
};

/**
 * Every `styles()` declaration the tree names, gathered before a line of it is written.
 *
 * A declaration is collected from where it is USED rather than from a list, which is the whole point of it — the
 * rules stay next to the element they dress — and it means one declared and never named writes nothing at all.
 */
export const collectDeclarations = (
  author: SpaceAuthor,
  rootClass: ClassList | undefined,
  body: ElementSpec[],
  rootWhere: string
): void => {
  const collect = (value: ClassList | undefined, usedBy: () => string): void => {
    for (const ref of value ? classRefs(value) : []) {
      if (typeof ref !== 'string') {
        declareClass(
          author,
          ref.name,
          ref.rules,
          () => `${declaredAt(ref)}, used by ${usedBy()}`,
          () => declaredAt(ref),
          ref
        );
      }
    }
  };

  const walk = (spec: ElementSpec): void => {
    const element = (): string => {
      const at = writtenAt(spec);

      return `${spec.type}${spec.id === undefined ? '' : ` "${spec.id}"`}${at === undefined ? '' : ` at ${at}`}`;
    };
    // Rules of the element's own on top of its classes are not a declaration: they are written with the element.
    collect(spec.class === undefined ? undefined : splitClassList(spec.class).refs, element);
    Object.entries(spec.slots ?? {}).forEach(([slot, value]) => {
      const entries: readonly unknown[] = Array.isArray(value) ? value : [value];
      if (!entries.every(isClassRef)) {
        throw new AuthoringError(
          'slot-not-class',
          `The "${slot}" slot of ${element()} is handed rules of its own, or no class at all. A slot wears classes only: declare the rules with \`styles()\` and hand the declaration — \`slots: { ${slot}: [base, styles('…', { … })] }\`.`
        );
      }

      collect(value, () => `the "${slot}" slot of ${element()}`);
    });
    spec.children?.forEach(walk);
  };

  collect(rootClass, () => rootWhere);
  body.forEach(walk);
};

/**
 * A class an element names has to be one the space declared.
 *
 * The failure it removes is the quietest one in the whole surface: a mistyped class is a selector nothing
 * defines, so the element renders unstyled and every layer below considers that perfectly valid — the class
 * exists as a name, it simply has no rules.
 */
const assertClass = (author: SpaceAuthor, name: string, where: string): void => {
  if (author.classRules.has(name)) {
    return;
  }

  const classes = [...author.classRules.keys()];

  throw new AuthoringError(
    'class-undeclared',
    `${where} names the class "${name}", which this space does not declare${didYouMean(name, classes) || '.'} Declare it in \`classes\`, hand it a \`styles()\` declaration, or write the rules inline with \`css\`.`
  );
};

/** An ancestor condition names a class some ancestor wears; one this space does not declare can never match. */
export const assertAncestorClasses = (author: SpaceAuthor): void => {
  for (const breakpoint of BREAKPOINTS) {
    for (const item of Object.values(author.platform[breakpoint])) {
      for (const [slot, block] of Object.entries(item.attributes)) {
        // The parent (`'>'`) is named by nothing it wears, so there is no class of it to declare.
        for (const ancestor of Object.keys(block.ancestors ?? {}).filter(name => !isParentAncestor(name))) {
          assertClass(
            author,
            ancestor,
            `The ${item.type} "${item.name}" (${slot}, ${breakpoint}), in its \`ancestors\`,`
          );
        }
      }
    }
  }
};

/**
 * The fonts, through the parser every other way into a manifest uses.
 *
 * A face with no fallback, no weights or an unknown source is still a `<link>` the page server writes, and the
 * page then renders in whatever the browser picks — so it is refused here, by index and family, with the
 * parser's own reason.
 */
export const parseFonts = (author: SpaceAuthor, fonts: SpaceFont[]): SpaceFont[] => {
  return fonts.map((font, index) => {
    try {
      return parseSpaceFont(font);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      throw new AuthoringError(
        'font-invalid',
        `Font ${index} ("${font.family}") in space "${author.spec.permanentUrl}": ${reason}`,
        {
          cause: error
        }
      );
    }
  });
};

/**
 * A tablet rule a phone never sees.
 *
 * The breakpoints are RANGES, not a cascade: `tablet` is 48–64rem, `mobile` is up to 48rem, and each inherits
 * only from `desktop`. So a layout that collapses to a column at tablet and says nothing for mobile comes back as
 * desktop columns on a phone — the narrowest screen gets the widest layout, and every check passes. A warning and
 * not a refusal, because a rule meant for tablets alone is legal, just rarely what anybody meant.
 */
const warnTabletOnly = (author: SpaceAuthor, blocks: ResponsiveBlock, where: string): void => {
  const tablet = blocks.tablet?.default ?? {};
  const mobile = blocks.mobile?.default ?? {};
  // Hidden on a phone, it shows nothing there for a tablet rule to have reached.
  if (mobile.display === 'none') {
    return;
  }

  const skipped = Object.keys(tablet).filter(property => !Object.hasOwn(mobile, property));
  if (skipped.length === 0) {
    return;
  }

  author.styleWarnings.push({
    code: 'tablet-rule-skips-mobile',
    message: `${where} sets ${skipped.join(', ')} for tablet but not for mobile. Tablet (48–64rem) and mobile (up to 48rem) are separate ranges and mobile inherits desktop, not tablet — so phones get the desktop value back. For both, write it once under \`compact\` (tablet and mobile together); repeat it under \`mobile\` otherwise.`,
    details: { properties: skipped }
  });
};

export const writeSelector = (author: SpaceAuthor, name: string, blocks: ResponsiveBlock, where: string): void => {
  warnTabletOnly(author, blocks, where);

  for (const breakpoint of BREAKPOINTS) {
    const block = blocks[breakpoint];
    if (!block) {
      continue;
    }

    author.platform[breakpoint][name] = withCache({ name, type: 'class', attributes: { base: block } });
  }
};

/**
 * A name given to an element's own selector has to be one nothing else answers to: a declared class would have its
 * rules overwritten, and a second element naming it would share rules it never asked for.
 */
const assertOwnSelector = (author: SpaceAuthor, name: string, where: string): void => {
  if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name)) {
    throw new AuthoringError(
      'selector-invalid',
      `${where} names its selector "${name}", which is not a CSS class name.`
    );
  }

  if (author.classRules.has(name) || author.ownSelectors.has(name)) {
    throw new AuthoringError(
      'selector-taken',
      `${where} names its selector "${name}", which ${author.classRules.has(name) ? 'is a class this space declares' : 'another element already names'}. Use \`class\` to share rules; a selector of an element's own is its alone.`
    );
  }

  author.ownSelectors.add(name);
};

/**
 * A shared class when one was named, otherwise a selector of this element's own, named after where it sits.
 *
 * The two are exclusive because an element has exactly one base selector: asking for a shared rule AND a rule of
 * its own is a question with no answer, and the old behaviour — keep the class, drop the rules — is the kind of
 * silence this whole surface exists to remove.
 */
export const baseSelectorFor = (
  author: SpaceAuthor,
  path: string,
  /** The element's id, written or given: rules on top of a class become a class named after it. */
  id: string,
  spec: {
    type: string;
    class?: ElementClassList;
    css?: CssSpec;
    states?: StatesSpec;
    selector?: string;
  },
  place = path
): string => {
  // Refused, and written with the class it wears, so the element is still there for the rest of the checks.
  if (spec.class && spec.selector) {
    author.refusals.push({
      place,
      at: writtenAt(spec),
      code: 'class-and-selector',
      message: `Element "${spec.type}" at ${place} names its own selector ("${spec.selector}") and wears a shared class. A shared class IS its selector: drop one of the two.`
    });
  }

  if (spec.class) {
    const { refs, modifiers } = splitClassList(spec.class);
    const names = classNames(refs);
    names.forEach(name => assertClass(author, name, `Element "${spec.type}" at ${place}`));

    if (spec.css || spec.states) {
      author.refusals.push({
        place,
        at: writtenAt(spec),
        code: 'class-and-css',
        message: `Element "${spec.type}" at ${place} declares both a shared class ("${names.join(' ')}") and ${spec.css ? 'css' : 'states'} of its own. An element has one base selector: put the rules on top of the class instead — \`class: [${names[0] ?? 'card'}, { … }]\` — or into the class itself.`
      });
    }

    const modifier = modifierFor(author, id, spec, modifiers, place);

    return [...names, ...(modifier ? [modifier] : [])].join(' ');
  }

  // A class may carry any name — one read back from a builder document is `container-555c` — so the name derived
  // for an element's own rules steps past a class that already answers to it rather than overwriting its rules.
  if (spec.selector !== undefined) {
    assertOwnSelector(author, spec.selector, `Element "${spec.type}" at ${place}`);
    writeSelector(
      author,
      spec.selector,
      toBlocks({ css: spec.css, states: spec.states }),
      `Element "${spec.type}" at ${place}`
    );

    return spec.selector;
  }

  let selector = `${spec.type}-${digest(`plitzi:selector:${author.spec.permanentUrl}:${path}`, 4)}`;
  for (let attempt = 1; author.classRules.has(selector) || author.ownSelectors.has(selector); attempt += 1) {
    selector = `${spec.type}-${digest(`plitzi:selector:${author.spec.permanentUrl}:${path}#${attempt}`, 4)}`;
  }

  author.ownSelectors.add(selector);

  writeSelector(
    author,
    selector,
    toBlocks({ css: spec.css, states: spec.states }),
    `Element "${spec.type}" at ${place}`
  );

  return selector;
};

/**
 * The class an element's own rules on top of its classes become — `<id>--own`, written after every shared class so it
 * wins over them. One set per element, and only on an element with an `id`, which is what names it for good.
 */
const modifierFor = (
  author: SpaceAuthor,
  id: string,
  spec: { type: string },
  modifiers: StyleSpec[],
  place: string
): string | undefined => {
  if (modifiers.length === 0) {
    return undefined;
  }

  const where = `Element "${spec.type}" at ${place}`;
  if (modifiers.length > 1) {
    author.refusals.push({
      place,
      at: writtenAt(spec),
      code: 'modifier-count',
      message: `${where} has ${modifiers.length} sets of rules in its class list. Write one, after its classes: \`class: [card, { opacity: '0.5', 'margin-top': '8px' }]\`.`
    });
  }

  const name = modifierClassName(id);
  assertOwnSelector(author, name, where);
  const blocks = toBlocks(modifiers[0]);
  writeSelector(author, name, blocks, where);
  author.ownRules.set(name, {
    blocks,
    written: () => {
      const at = writtenAt(spec);

      return `the own rules of "${id}"${at === undefined ? '' : ` at ${at}`}`;
    }
  });

  return name;
};

/**
 * The type's other selectors, empty: each one is a `plitzi__<type>-<slot>` class on the element's own markup.
 *
 * Named or not, the element wears them — that is what a space's per-type `slots` style addresses. A modal whose
 * document did not mention `rootContainer` was the SDK's white default in a dark theme, beside a modal that styled
 * the slot itself and so followed the space.
 */
export const declaredSlots = (author: SpaceAuthor, type: string): Record<string, string> => {
  const slots = author.options.slotNames?.[type] ?? [];

  return Object.fromEntries(slots.map(slot => [slot, '']));
};

export const slotSelectors = (author: SpaceAuthor, spec: ElementSpec, place: string): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(spec.slots ?? {}).map(([slot, value]) => {
      const names = classNames(value);
      names.forEach(name => assertClass(author, name, `Slot "${slot}" of element "${spec.type}" at ${place}`));

      return [slot, names.join(' ')];
    })
  );
};

/** Whether `variant` is declared by the element's type style or by one of its classes — where `variantOwner` looks. */
export const variantDeclared = (author: SpaceAuthor, spec: ElementSpec, variant: string): boolean => {
  if (author.spec.elements?.[spec.type]?.variants?.[variant] !== undefined) {
    return true;
  }

  return (
    spec.class !== undefined &&
    classNames(splitClassList(spec.class).refs).some(name =>
      Object.values(author.classRules.get(name) ?? {}).some(block => block.variants?.[variant] !== undefined)
    )
  );
};
