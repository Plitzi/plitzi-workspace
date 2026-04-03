/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyObject = Record<string | number, any>;

const setByPath = <T extends AnyObject>(obj: T, path: string | (string | number)[], value: any): T => {
  const isArray = Array.isArray(path);
  if (typeof path !== 'string' && !isArray) {
    return value;
  }

  const keys = isArray ? path : path.split('.');
  if (!keys.length) {
    return value;
  }

  const [first, ...rest] = keys;
  const key = isNaN(Number(first)) ? first : Number(first);

  return { ...obj, [key]: rest.length ? setByPath((obj as AnyObject)[key] ?? {}, rest, value) : value } as T;
};

export default setByPath;
