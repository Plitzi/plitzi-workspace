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
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }
};

export default serialize;
