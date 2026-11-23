/**
 * A person's initials from their name: the first letter of the first word and of the last — "Ada Lovelace" is AL, an
 * address its first letter alone ("ada@example.com" is A). Letters, not code units: an accented or a CJK one stays whole.
 */
export const initialsOf = (name: string): string => {
  const words = name
    .split('@')[0]
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const first = words.at(0);
  if (first === undefined) {
    return '';
  }

  const last = words.length > 1 ? words.at(-1) : undefined;

  return [first, last]
    .map(word => (word === undefined ? '' : (Array.from(word).at(0) ?? '')))
    .join('')
    .toLocaleUpperCase();
};

/**
 * A hue of its own for a name, 0–359: the same name is the same colour on every page and in every list, and two names
 * beside each other are told apart. A hash, not a lookup: there is nothing to keep.
 */
export const hueOf = (name: string): number => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }

  return hash;
};
