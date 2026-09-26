import type { Point } from '../../board/model.ts';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const newId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');

export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

export const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(entry => typeof entry === 'number' && Number.isFinite(entry));

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
