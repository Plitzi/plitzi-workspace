/**
 * An SVG as it is worth carrying in a space: what a design tool wrote for itself taken out — the XML prolog and doctype,
 * comments, `<metadata>`, an editor's own elements and attributes (Inkscape, Sodipodi, Sketch, Figma's `data-name`) —
 * and the whitespace between tags. What draws, and its `<title>`, stay as they were.
 *
 * Every byte of an inline SVG is in the space's documents and in every page that shows it, so a logo exported from a
 * design tool with half its size in notes to itself is that much heavier for nothing. `svg()` checks and sanitises
 * what it is given; this only makes it smaller.
 */
export const compactSvg = (markup: string): string =>
  markup
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    // An editor's own elements, whole: `<sodipodi:namedview …/>`, `<inkscape:… >…</inkscape:…>`.
    .replace(/<(sodipodi|inkscape|sketch):[\w-]+[^>]*\/>/g, '')
    .replace(/<(sodipodi|inkscape|sketch):([\w-]+)[^>]*>[\s\S]*?<\/\1:\2>/g, '')
    // …and its attributes, and the namespaces they were declared under.
    .replace(/\s(?:sodipodi|inkscape|sketch):[\w-]+="[^"]*"/g, '')
    .replace(/\sxmlns:(?:sodipodi|inkscape|sketch|dc|cc|rdf)="[^"]*"/g, '')
    .replace(/\sdata-name="[^"]*"/g, '')
    .replace(/>\s+</g, '><')
    .trim();
