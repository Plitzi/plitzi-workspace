// Catalogs — the VOCABULARIES the MCP validates and advertises against (not read projections, which live beside
// the ops as translators). Most of them are no longer the MCP's to keep: an agent authoring a flow and a seed
// authoring one need the same list of actions and the same param shapes, so each vocabulary lives with the code it
// describes and is re-exported here for the ops and validators that already read it from this barrel.
//
// From the SDK packages:
// - paramSpec / transformers  — @plitzi/sdk-shared/authoring: the param shape every catalog shares, and the
//                               binding transformers, beside the runtime implementations they describe
// - global callbacks          — @plitzi/sdk-interactions/authoring: gathered from the sources that register them
// - utilities                 — @plitzi/sdk-interactions/authoring: beside the utility implementations
// - element callbacks         — @plitzi/sdk-elements/authoring: the `callback` actions every element registers
// - the CSS vocabulary        — @plitzi/sdk-style/authoring: valid property keys + shorthand expansion
//
// - element semantics         — @plitzi/sdk-elements/authoring: what each built-in type is FOR, read off the
//                               declarations (it was a curated table here, and had never heard of three of them)
//
// The MCP's own:
// - observed               — interaction actions / data-source paths observed in a space (+ the built-in catalogs)
// - registry               — the element-type registry (observed types enriched with builtin/plugin metadata)

export * from '@plitzi/sdk-shared/authoring';
export {
  BUILTIN_GLOBAL_CALLBACKS,
  BUILTIN_UTILITIES,
  applyBuiltinCallback,
  applyUtility,
  getGlobalCallback,
  getUtility
} from '@plitzi/sdk-interactions/authoring';
export type { BuiltinGlobalCallback, BuiltinUtility } from '@plitzi/sdk-interactions/authoring';
export {
  BUILTIN_ELEMENT_CALLBACKS,
  applyElementCallback,
  elementCatalog,
  elementTypeNames,
  getElementCallback
} from '@plitzi/sdk-elements/authoring';
export type { BuiltinElementCallback, ElementSemantics } from '@plitzi/sdk-elements/authoring';
export {
  cssProperties,
  cssShorthands,
  expandShorthand,
  expandShorthandPatch,
  isCssProperty,
  shorthandLonghands,
  suggestCssProperty
} from '@plitzi/sdk-style/authoring';
export type { CssPatch } from '@plitzi/sdk-style/authoring';

export * from './observed';
export * from './registry';
