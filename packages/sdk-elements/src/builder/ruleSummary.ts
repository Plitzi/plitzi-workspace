import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { Field } from '@plitzi/plitzi-ui/QueryBuilder';

const OPERATOR_WORDS: Readonly<Record<string, string>> = {
  '=': 'is',
  '!=': 'is not',
  '<': 'under',
  '<=': 'at most',
  '>': 'over',
  '>=': 'at least',
  contains: 'contains',
  beginsWith: 'starts with',
  endsWith: 'ends with',
  doesNotContain: 'does not contain',
  in: 'is one of',
  notIn: 'is none of'
};

/** A field as a person reads it: its label, or the last part of an address one (`queryParams.utm_source`). */
const fieldWord = (name: string, fields: Readonly<Record<string, Field>>): string => {
  const label = Object.hasOwn(fields, name) ? fields[name].label : name;

  return label === name ? (name.split('.').pop() ?? name) : label;
};

const ruleWords = (rule: unknown, fields: Readonly<Record<string, Field>>): string => {
  if (!isRecord(rule)) {
    return '';
  }

  if (Array.isArray(rule.rules)) {
    const inner = groupWords(rule, fields);

    return inner === '' ? '' : `(${inner})`;
  }

  const field = typeof rule.field === 'string' ? fieldWord(rule.field, fields) : '';
  const operator = typeof rule.operator === 'string' ? (OPERATOR_WORDS[rule.operator] ?? rule.operator) : 'is';
  if (typeof rule.value === 'boolean') {
    // A yes-or-no field reads as itself: "Visitor came before", or "not Visitor came before".
    return rule.value === (operator !== 'is not') ? field : `not ${field}`;
  }

  const scalar = (value: unknown): string =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const value = Array.isArray(rule.value) ? rule.value.map(scalar).join(', ') : scalar(rule.value);

  return `${field} ${operator} ${value}`.trim();
};

const groupWords = (group: Record<string, unknown>, fields: Readonly<Record<string, Field>>): string => {
  const rules = Array.isArray(group.rules) ? group.rules : [];
  const joiner = group.combinator === 'or' ? ' or ' : ' and ';

  return rules
    .map(rule => ruleWords(rule, fields))
    .filter(Boolean)
    .join(joiner);
};

/**
 * A variant's rule in a line a person reads — `Visitor language is es and Visitor device is mobile` — or none for one
 * with no conditions (the "everyone else" a variants element chosen by rules ends with).
 */
export const ruleSummary = (when: unknown, fields: Readonly<Record<string, Field>>): string =>
  isRecord(when) ? groupWords(when, fields) : '';
