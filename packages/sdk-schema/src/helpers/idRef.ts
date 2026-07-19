import type { Element } from '@plitzi/sdk-shared';

// Everything idRefs need answered: whether one is well formed, whether a schema can take it, minting a free one,
// and moving a set of elements onto new ones. Every check goes through `isValidIdRef` — the charset is stated once,
// here, so a caller cannot drift by re-testing its own regex.
//
// An idRef is opt-in: nothing hands one out on its own. An element gets one when a person types it in the builder
// or an agent writes it through the MCP, and until then it publishes no data source. Minting is therefore only
// used where an existing ref has to be replaced — cloning a subtree that already carries refs.

const ID_REF_RE = /^[A-Za-z](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/;

/** True when an idRef is well formed: it starts with a letter and then carries letters, numbers, hyphens and
 *  underscores. Leading letter keeps a source `<type>_<idRef>` a valid twig identifier. A '.' would split the
 *  `<type>_<idRef>.<field>` source path and an interaction target lookup — so it is not allowed. A source name
 *  uses the first '_' as separator between `<type>` and `<idRef>` (element types are camelCase with no underscore),
 *  so underscores inside the idRef are unambiguous. A hyphen is allowed too: a source doubles as a twig token, and
 *  `processTwig` resolves a hyphenated `<type>_<idRef>` through `_context` subscript access. */
export const isValidIdRef = (idRef: string): boolean => ID_REF_RE.test(idRef);

/** Every idRef currently in use, so a new one can be checked or minted against it. */
export const takenIdRefs = (flat: Record<Element['id'], Element>): Set<string> => {
  const refs = new Set<string>();
  for (const element of Object.values(flat)) {
    if (element.idRef) {
      refs.add(element.idRef);
    }
  }

  return refs;
};

/** Why `idRef` cannot be used in this schema, phrased for a person, or null when it is free and well formed.
 *  `ignoreElementId` exempts the element being edited, so re-saving an element its own ref is not a conflict. */
export const idRefConflict = (
  flat: Record<Element['id'], Element>,
  idRef: string,
  ignoreElementId?: Element['id']
): string | null => {
  if (!isValidIdRef(idRef)) {
    return `"${idRef}" is not a valid reference: start with a letter, then letters, numbers, hyphens and underscores`;
  }

  const owner = Object.values(flat).find(element => element.idRef === idRef && element.id !== ignoreElementId);

  return owner ? `"${idRef}" is already used by another element in this space` : null;
};

/** Whether every idRef a write brings into a schema is usable: well formed, free — an element already stored never
 *  clashes with itself — and not repeated inside the incoming set, which `idRefConflict` cannot see on its own
 *  because those elements are not in `flat` yet. */
export const idRefsUsable = (flat: Record<Element['id'], Element>, elements: Element[]): boolean => {
  const incoming = new Set<string>();
  for (const element of elements) {
    if (!element.idRef) {
      continue;
    }

    if (incoming.has(element.idRef) || idRefConflict(flat, element.idRef, element.id)) {
      return false;
    }

    incoming.add(element.idRef);
  }

  return true;
};

/** A unique, charset-safe idRef for a new element: `<type>-<n>`, incrementing until `isTaken` says it is free.
 *  The hyphen sits between two alphanumeric runs, so it is valid (never leading or trailing) and readable. */
export const makeIdRef = (type: string, isTaken: (candidate: string) => boolean): string => {
  const base = type.replace(/[^A-Za-z0-9]/g, '') || 'element';
  let n = 1;
  while (isTaken(`${base}-${n}`)) {
    n += 1;
  }

  return `${base}-${n}`;
};

// Rewrites a data-source name onto a new idRef. A source is `<type>_<idRef>` optionally followed by `.<field...>`;
// sources with no `_` are not element-scoped (a Form registers a bare `form`) and are left alone.
const remapSource = (source: string, mapRefs: Record<string, string>): string => {
  const dot = source.indexOf('.');
  const head = dot === -1 ? source : source.slice(0, dot);
  const separator = head.indexOf('_');
  if (separator === -1) {
    return source;
  }

  const next = mapRefs[head.slice(separator + 1)];
  if (!next) {
    return source;
  }

  return `${head.slice(0, separator + 1)}${next}${dot === -1 ? '' : source.slice(dot)}`;
};

// A source name embedded inside free text: a twig token (`{{ apiContainer_card-1.data.name }}`), a transformer
// param or a query-builder operand. `<type>_<idRef>` — the idRef the charset `isValidIdRef` states (starts with a
// letter, then letters, numbers, hyphens and underscores). A bare idRef is never rewritten (that is the corruption
// `repointIdRefs` guards against); only a full `<type>_<idRef>` token is, so a `node_<hexId>` survives untouched.
// The regex splits on the first `_` (element types are camelCase with no underscore), so idRef underscores are
// unambiguous.
const SOURCE_TOKEN_RE = /([A-Za-z][A-Za-z0-9]*)_([A-Za-z][A-Za-z0-9_-]*)/g;

const remapTokenString = (value: string, mapRefs: Record<string, string>): string =>
  value.replace(SOURCE_TOKEN_RE, (match, type: string, ref: string) => {
    const next = mapRefs[ref];

    return next ? `${type}_${next}` : match;
  });

// Rewrites every `<type>_<idRef>` token found in the string leaves of an arbitrary value — a transformer param
// tree, an interaction's params or a query-builder `when`, whose shapes this pass does not need to know. Writes
// a leaf only when the rename changes it, so an untouched branch never triggers a copy.
const remapTokensDeep = (value: unknown, mapRefs: Record<string, string>): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string') {
        const next = remapTokenString(item, mapRefs);
        if (next !== item) {
          value[index] = next;
        }

        return;
      }

      remapTokensDeep(item, mapRefs);
    });

    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') {
      const next = remapTokenString(item, mapRefs);
      if (next !== item) {
        record[key] = next;
      }

      continue;
    }

    remapTokensDeep(item, mapRefs);
  }
};

/** Apply an idRef renaming (old → new) across a set of elements: the idRef itself plus every reference written
 *  against it — a binding's data `source`, its transformer params and `when`, and an interaction's target
 *  `elementId`, params and `when`. A ref absent from the map is left alone, so references leaving this set keep
 *  pointing outward, which is what callers want.
 *
 *  Ids are remapped by a blind string replace over the serialized tree (see `FlatMap.cloneElements`); that is safe
 *  for a 24-char hex id but not for an idRef, which is short and human-readable — replacing "card-1" everywhere
 *  would corrupt any label containing it. Hence this field-by-field pass: a plain `source` goes through
 *  `remapSource`, embedded tokens (twig, transformer params, query-builder operands) through `remapTokensDeep`,
 *  which only ever rewrites a full `<type>_<idRef>` token. */
export const repointIdRefs = (elements: Record<Element['id'], Element>, mapRefs: Record<string, string>): void => {
  for (const element of Object.values(elements)) {
    if (element.idRef && mapRefs[element.idRef]) {
      element.idRef = mapRefs[element.idRef];
    }

    for (const bindings of Object.values(element.definition.bindings ?? {})) {
      for (const binding of bindings) {
        const source = remapSource(binding.source, mapRefs);
        if (source !== binding.source) {
          binding.source = source;
        }

        if (binding.transformers) {
          remapTokensDeep(binding.transformers, mapRefs);
        }

        if (binding.when) {
          remapTokensDeep(binding.when, mapRefs);
        }
      }
    }

    for (const interaction of Object.values(element.definition.interactions ?? {})) {
      // elementId is `string | null` (null when the step targets a source/global, not an element), so only a
      // non-empty ref can be remapped.
      if (interaction.elementId) {
        const elementId = mapRefs[interaction.elementId];
        if (elementId) {
          interaction.elementId = elementId;
        }
      }

      remapTokensDeep(interaction.params, mapRefs);

      if (interaction.when) {
        remapTokensDeep(interaction.when, mapRefs);
      }
    }
  }
};

/** Give every element in a freshly cloned subtree a new idRef, so the copy wires to itself instead of to the
 *  original it was cloned from. An element that had no idRef stays without one — a clone copies what is there. */
export const remapClonedRefs = (elements: Record<Element['id'], Element>, isTaken: (ref: string) => boolean): void => {
  const mapRefs: Record<string, string> = {};
  const minted = new Set<string>();
  for (const element of Object.values(elements)) {
    if (!element.idRef) {
      continue;
    }

    const idRef = makeIdRef(element.definition.type, candidate => isTaken(candidate) || minted.has(candidate));
    minted.add(idRef);
    mapRefs[element.idRef] = idRef;
  }

  repointIdRefs(elements, mapRefs);
};
