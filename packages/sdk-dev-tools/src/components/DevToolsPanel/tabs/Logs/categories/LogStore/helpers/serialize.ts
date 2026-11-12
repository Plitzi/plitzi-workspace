const serialize = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'function') {
    return 'Function';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // What JSON cannot write — a cycle, a BigInt — is shown as the value says itself, `[object Object]` at worst.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- the last resort for a value JSON refused
    return String(value);
  }
};

export default serialize;
