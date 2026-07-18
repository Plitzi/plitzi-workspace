// Catalogs — the static and observed VOCABULARIES the MCP validates and advertises against (not read projections,
// which live beside the ops as translators). Grouped here so it is obvious which files are reference data:
// - builtinCallbacks   — built-in globalCallback actions → source module + param defaults (mirror of sdk-interactions)
// - builtinComponents  — curated metadata for built-in element types
// - cssCatalog         — valid CSS property keys + shorthand expansion
// - observed           — interaction actions / data-source paths observed in a space (+ built-in globalCallbacks)
// - registry           — the element-type registry (observed types enriched with builtin/plugin metadata)

export * from './builtinCallbacks';
export * from './builtinComponents';
export * from './cssCatalog';
export * from './observed';
export * from './registry';
