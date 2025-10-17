/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const getRandomInteger = (min: number, max: number) => Math.random() * (max - min) + min;

type AnyFunc = (...args: any[]) => any;

export const compose = (...funcs: Array<AnyFunc>): AnyFunc => {
  if (funcs.length === 0) {
    return (arg: any) => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args))
  );
};
