/**
 * The name an author probably meant.
 *
 * Levenshtein distance, capped: a class or a type that is one typo away is worth naming in the error, and anything
 * further away is noise that reads like a wrong guess. Small enough sets (a space's classes, the element
 * catalogue) that the quadratic cost never matters.
 */
const distance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }

    previous = current;
  }

  return previous[b.length];
};

export const closest = (name: string, candidates: Iterable<string>): string | undefined => {
  const limit = Math.max(2, Math.floor(name.length / 3));
  let best: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const value = candidate.toLowerCase() === name.toLowerCase() ? 1 : distance(name, candidate);
    if (value < bestDistance) {
      best = candidate;
      bestDistance = value;
    }
  }

  return bestDistance <= limit ? best : undefined;
};

/** `… — did you mean "x"?` or nothing at all: the tail of an error message. */
export const didYouMean = (name: string, candidates: Iterable<string>): string => {
  const suggestion = closest(name, candidates);

  return suggestion ? ` — did you mean "${suggestion}"?` : '';
};
