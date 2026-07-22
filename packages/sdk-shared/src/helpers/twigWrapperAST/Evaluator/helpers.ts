export const isTruthy = (value: unknown): boolean => {
  if (value === null || value === undefined || value === false || value === '' || value === 0) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
};

export const valueIn = (needle: unknown, haystack: unknown): boolean => {
  if (typeof haystack === 'string') {
    return haystack.includes(String(needle));
  }
  if (Array.isArray(haystack)) {
    return haystack.includes(needle);
  }
  if (haystack !== null && typeof haystack === 'object') {
    return Object.keys(haystack).includes(String(needle));
  }
  return false;
};

export const resolveCollection = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value as unknown[];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return null;
};

export const resolveObjectEntries = (value: unknown): [string, unknown][] | null => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>);
  }
  return null;
};
