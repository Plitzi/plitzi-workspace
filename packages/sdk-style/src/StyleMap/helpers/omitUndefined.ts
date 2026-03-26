const omitUndefined = <T extends object>(obj: T) => {
  const out: T = {} as T;
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }

  return out;
};

export default omitUndefined;
