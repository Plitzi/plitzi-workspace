import { evaluateRuleGroup } from '../helpers/ruleEvaluator';

import type { VariableScope } from '../dataSource/resolveVariables';
import type { RuleGroup } from '../helpers/ruleEvaluator';
import type { Schema, SchemaFlag, SSRUser } from '../types';

/**
 * Who decided a flag, weakest first: the space's own declaration, then the server rendering it, then the SDK
 * embedding it, then a tester with the dev tools open. Each layer only ever answers for a flag the space declares.
 */
export const FLAG_LAYERS = ['space', 'server', 'sdk', 'qa'] as const;

export type FlagLayer = (typeof FLAG_LAYERS)[number];

export type FlagOverrideLayer = Exclude<FlagLayer, 'space'>;

/** What each layer above the space says, by flag name. A layer that says nothing about a flag leaves it alone. */
export type FlagOverrides = Partial<Record<FlagOverrideLayer, Record<string, boolean>>>;

/** The visitor, as a flag's rule sees them: never a token, never anything the rules have no business matching on. */
export type FlagUser = { authenticated: boolean; email?: string; username?: string; roles?: string[] };

/** The visitor a server resolved, as a flag's rule sees them — the same fields the browser's rules see. */
export const flagUserFromSSR = (user: Pick<SSRUser, 'email' | 'username' | 'roles'> | undefined): FlagUser =>
  user
    ? { authenticated: true, email: user.email, username: user.username, roles: user.roles }
    : { authenticated: false };

/** What a flag's rules are matched against: everything a variable's are, and who is visiting. */
export type FlagScope = VariableScope & { user?: FlagUser };

/**
 * One flag's answer, and where it came from: the layer that decided, and — when the space did — the index of the
 * rule that matched, absent when it was the flag's own default. What the dev tools show beside the value.
 */
export type FlagResolution = { value: boolean; layer: FlagLayer; rule?: number };

const OVERRIDE_LAYERS: readonly FlagOverrideLayer[] = ['server', 'sdk', 'qa'];

/**
 * Whether a rule says anything at all. A rule just added in the builder has an empty group, and the evaluator reads
 * an empty `and` as true — so an unfinished rule would turn the flag the moment it was added. It is skipped instead,
 * and the linter says it is there.
 */
export const hasConditions = (when: unknown): when is RuleGroup =>
  typeof when === 'object' &&
  when !== null &&
  'rules' in when &&
  Array.isArray(when.rules) &&
  when.rules.some(
    (rule: unknown) => typeof rule === 'object' && rule !== null && !('enabled' in rule && rule.enabled === false)
  );

const ruleMatching = (flag: SchemaFlag, scope: FlagScope): number =>
  Array.isArray(flag.rules)
    ? flag.rules.findIndex(rule => hasConditions(rule.when) && evaluateRuleGroup(rule.when, scope))
    : -1;

const resolveDeclared = (flag: SchemaFlag, scope: FlagScope): FlagResolution => {
  const index = ruleMatching(flag, scope);
  if (index === -1) {
    return { value: flag.value, layer: 'space' };
  }

  return { value: flag.rules[index].value, layer: 'space', rule: index };
};

/**
 * Every flag the space declares, resolved for this render: `{ newCheckout: { value: true, layer: 'space', rule: 0 } }`.
 *
 * The space answers first — the first of a flag's rules that matches, or its default — and each layer above it may
 * replace that answer, in order. An override for a flag the space does not declare is not an answer to anything and
 * is dropped here; {@link undeclaredFlagOverrides} names those so whoever set one can be told.
 */
export const resolveFlags = (
  declared: Schema['flags'],
  scope: FlagScope = {},
  overrides: FlagOverrides = {}
): Record<string, FlagResolution> =>
  Object.fromEntries(
    Object.entries(declared ?? {}).map(([name, flag]) => {
      const resolution = OVERRIDE_LAYERS.reduce<FlagResolution>(
        (current, layer) => {
          const value = overrides[layer]?.[name];

          return typeof value === 'boolean' ? { value, layer } : current;
        },
        resolveDeclared(flag, scope)
      );

      return [name, resolution];
    })
  );

/** The answers alone, as the `flags` source publishes them: `{ newCheckout: true }`. */
export const flagValues = (resolutions: Record<string, FlagResolution>): Record<string, boolean> =>
  Object.fromEntries(Object.entries(resolutions).map(([name, { value }]) => [name, value]));

/** Overrides naming a flag the space does not declare — each one a typo or a flag removed from the space. */
export const undeclaredFlagOverrides = (
  declared: Schema['flags'],
  overrides: FlagOverrides
): { layer: FlagOverrideLayer; name: string }[] =>
  OVERRIDE_LAYERS.flatMap(layer =>
    Object.keys(overrides[layer] ?? {})
      .filter(name => !Object.hasOwn(declared ?? {}, name))
      .map(name => ({ layer, name }))
  );

/** Whether a flag gate lets its element exist, given the flags as they resolved. An undeclared flag resolves off. */
export const passesFlagGate = (gate: { name: string; is: boolean } | undefined, values: Record<string, boolean>) =>
  !gate || (values[gate.name] ?? false) === gate.is;
