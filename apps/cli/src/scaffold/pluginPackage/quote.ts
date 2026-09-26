/**
 * Free text somebody typed — a title, a description, an owner — written into generated source.
 *
 * Interpolated bare, one apostrophe ("Carlos's picker") ends the string it lands in and the generated project does not
 * parse; these write it the way each kind of file reads it back.
 */

/**
 * A TypeScript string literal, quoted the way the generated project's own Prettier would quote it: single quotes,
 * unless the text holds more of them than of double quotes — so the file needs no reformatting on its first save.
 */
export const tsString = (value: string): string => {
  // \x22 and \x27 are the two quotes: spelled so, neither needs a quote of the other kind around it.
  const singles = value.split('\x27').length - 1;
  const doubles = value.split('\x22').length - 1;
  const quote = singles > doubles ? '\x22' : '\x27';
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');

  return `${quote}${escaped}${quote}`;
};

/** Text inside an HTML element. */
export const htmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
