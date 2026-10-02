import type { SchemaFlag } from '../types';

/** A flag name: what `{{ flags.<name> }}` reads, so it has to be a valid key in a template path. */
export const FLAG_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Names a path resolver walks into instead of reading: a flag called `__proto__` would be a way into the prototype.
const RESERVED_FLAG_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

export const isFlagName = (name: string): boolean => FLAG_NAME_PATTERN.test(name) && !RESERVED_FLAG_NAMES.has(name);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether a value is a flag as the resolver reads it — what every writer checks before storing one: a mutation, the
 * live channel, the linter. A rule's `when` has to be a group; whether it says anything is the linter's to warn about.
 */
export const isSchemaFlag = (value: unknown): value is SchemaFlag =>
  isRecord(value) &&
  typeof value.value === 'boolean' &&
  (value.description === undefined || typeof value.description === 'string') &&
  Array.isArray(value.rules) &&
  value.rules.every((rule: unknown) => isRecord(rule) && typeof rule.value === 'boolean' && isRecord(rule.when));
