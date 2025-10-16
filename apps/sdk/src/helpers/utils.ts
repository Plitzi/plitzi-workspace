/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const getRandomInteger = (min: number, max: number) => Math.random() * (max - min) + min;

export const compose = (...funcs) => {
  if (funcs.length === 0) {
    // infer the argument type so it is usable in inference down the line
    return (arg: any) => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(
    (a, b) =>
      (...args) =>
        a(b(...args))
  );
};
