/**
 * How long ago, in a few characters — `just now`, `5 min`, `2 h`, `3 d`, `4 mo`, `2 y` — for where a sentence does not
 * fit: a segment of the environment control, a domain's card. Never "about" or "less than": a glance, not a sentence.
 */
export const shortAge = (when: string | number | Date, now: number = Date.now()): string => {
  const seconds = Math.max(0, (now - new Date(when).getTime()) / 1000);
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'min']
  ];
  const unit = units.find(([size]) => seconds >= size);

  return unit ? `${String(Math.floor(seconds / unit[0]))} ${unit[1]}` : 'just now';
};

/** `5 min ago`, or `just now` — never "just now ago". */
export const ageAgo = (when: string | number | Date, now: number = Date.now()): string => {
  const age = shortAge(when, now);

  return age === 'just now' ? age : `${age} ago`;
};
