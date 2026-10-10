/**
 * A space's stylesheet, kept to the space when it is drawn inside another one.
 *
 * Every space writes its palette on `:root` and its classes — `.dark`, `.plitzi-sdk`, its own — for the whole
 * document, which is right for a space that IS the page and wrong for one inside it: the inner space's `:root` and
 * `.dark` rules repainted the page around it, its `.plitzi-sdk` rule restyled the outer space's root.
 *
 * `@scope` with no prelude limits the rules to the element the `<style>` hangs from — the SDK's own root, which also
 * wears the inner space's theme class — so `:root` is written `:scope` there, and `.dark` matches only inside.
 */
export const scopeSpaceCss = (css: string): string => `@scope{${css.replace(/:root\b/g, ':scope')}}`;
