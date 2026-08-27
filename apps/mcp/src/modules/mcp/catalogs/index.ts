// Catalogs — the VOCABULARIES the MCP validates and advertises against (not read projections, which live beside
// the ops as translators). Most of them are no longer the MCP's to keep: an agent authoring a flow and a seed
// authoring one need the same list of actions and the same param shapes, so each vocabulary lives with the code it
// describes and is re-exported here for the ops and validators that already read it from this barrel.
//
// From `@plitzi/sdk-authoring`, which is where all of it lives now — one package rather than a fragment inside
// each of five:
// - paramSpec / transformers  — the param shape every catalog shares, and the binding transformers
// - global callbacks          — gathered from the sources that register them
// - utilities                 — beside the utility implementations
// - element callbacks         — the `callback` actions every element registers
// - the CSS vocabulary        — valid property keys + shorthand expansion
// - element semantics         — what each built-in type is FOR, read off the declarations (it was a curated table
//                               here, and had never heard of three of them)
//
// The MCP's own:
// - observed               — interaction actions / data-source paths observed in a space (+ the built-in catalogs)
// - registry               — the element-type registry (observed types enriched with builtin/plugin metadata)

export {
  BUILTIN_ELEMENT_CALLBACKS,
  BUILTIN_GLOBAL_CALLBACKS,
  BUILTIN_TRANSFORMERS,
  BUILTIN_UTILITIES,
  applyBuiltinCallback,
  applyElementCallback,
  applyUtility,
  cssProperties,
  cssShorthands,
  elementCatalog,
  elementTypeNames,
  expandShorthand,
  expandShorthandPatch,
  getElementCallback,
  getGlobalCallback,
  getTransformer,
  getUtility,
  hiddenParams,
  invalidParams,
  isCssProperty,
  missingRequiredParams,
  reconcileParams,
  shorthandLonghands,
  suggestCssProperty,
  suggestTransformer,
  transformerCatalog
} from '@plitzi/sdk-authoring';
export type {
  BuiltinElementCallback,
  BuiltinGlobalCallback,
  BuiltinParam,
  BuiltinParamType,
  BuiltinTransformer,
  BuiltinUtility,
  CssPatch,
  ElementSemantics,
  InvalidParam,
  ParamSpec,
  TransformerInfo
} from '@plitzi/sdk-authoring';

export * from './observed';
export * from './registry';
