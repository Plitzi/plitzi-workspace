// Catalogs — the static and observed VOCABULARIES the MCP validates and advertises against (not read projections,
// which live beside the ops as translators). Grouped here so it is obvious which files are reference data:
// - paramSpec              — shared param shapes + reconcile/unknown/hidden helpers for the three interaction catalogs
// - builtinCallbacks       — built-in globalCallback actions → source module + param defaults (mirror sdk-interactions)
// - builtinElementCallbacks — built-in `callback` actions every element registers (setState: category/key/value/revert)
// - builtinUtilities       — built-in `utility` actions + their exact param schema (delayTime, twigTemplate, webHook)
// - builtinTransformers    — built-in data-binding transformers (mirror sdk-shared/dataSource/utility) + their params
// - builtinComponents      — curated metadata for built-in element types
// - cssCatalog             — valid CSS property keys + shorthand expansion
// - observed               — interaction actions / data-source paths observed in a space (+ the built-in catalogs)
// - registry               — the element-type registry (observed types enriched with builtin/plugin metadata)

export * from './paramSpec';
export * from './builtinCallbacks';
export * from './builtinElementCallbacks';
export * from './builtinUtilities';
export * from './builtinTransformers';
export * from './builtinComponents';
export * from './cssCatalog';
export * from './observed';
export * from './registry';
