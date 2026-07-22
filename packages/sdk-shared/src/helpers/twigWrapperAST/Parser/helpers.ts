export const extractFirstWord = (s: string): string => {
  const len = s.length;
  let i = 0;
  while (i < len && s.charCodeAt(i) !== 32 && s.charCodeAt(i) !== 9) {
    i++;
  }
  return s.slice(0, i);
};

export const isSimpleIdentifier = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }
  const ch = s.charCodeAt(0);
  if (!((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || ch === 95)) {
    return false;
  }
  for (let i = 1; i < len; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95) {
      continue;
    }
    return false;
  }
  return true;
};
