/**
 * The cascade layers the SDK's stylesheets are written in, lowest first — declared once by `plitzi-sdk.css` and the
 * builder's canvas, and again by the runtime stylesheet for a page that loads neither.
 *
 * A plugin's own stylesheet sits BELOW the space's: what the space writes about an element — its classes, `customCss`
 * — wins over the defaults the element's author shipped, whatever their specificity, as it does for a built-in
 * element. Above, a space's `customCss` hiding a marker inside a map lost to the plugin's `.marker { display: flex }`.
 */
export const PLUGIN_CSS_LAYER = 'plitzi-sdk-plugin';

export const RUNTIME_CSS_LAYER = 'plitzi-sdk-runtime';

/** A statement that must come first in a stylesheet, and so can never be inside a layer's block. */
const LEADING_STATEMENT = /^\s*(@charset\s[^;]*;|@import\s[^;]*;|\/\*[\s\S]*?\*\/)/;

/** `@import url(x) screen;` into the layer: `layer()` goes right after what it imports, before any condition. */
const importInto = (statement: string, layer: string): string => {
  const parsed = /^@import\s+(url\([^)]*\)|"[^"]*"|'[^']*')([^;]*);$/.exec(statement.trim());
  if (!parsed || /\blayer\b/.test(parsed[2])) {
    return statement;
  }

  return `@import ${parsed[1]} layer(${layer})${parsed[2]};`;
};

/**
 * A plugin's stylesheet, as it ships: everything in it in {@link PLUGIN_CSS_LAYER}. Written by whatever builds a
 * plugin — a server compiling one, `plitzi plugin pack` — so every way the file later reaches a page (a `<link>` in the
 * server's HTML, the SDK's assets, the builder's canvas) puts it in its place with no work of its own.
 *
 * Idempotent: a stylesheet already wrapped is returned as it is.
 */
export const inPluginLayer = (css: string, layer: string = PLUGIN_CSS_LAYER): string => {
  let rest = css;
  let head = '';
  for (let match = LEADING_STATEMENT.exec(rest); match; match = LEADING_STATEMENT.exec(rest)) {
    const statement = match[1];
    head += statement.startsWith('@import') ? importInto(statement, layer) : statement;
    rest = rest.slice(match[0].length);
  }

  if (rest.trimStart().startsWith(`@layer ${layer}`)) {
    return css;
  }

  return rest.trim() ? `${head}@layer ${layer}{${rest}}` : head;
};
