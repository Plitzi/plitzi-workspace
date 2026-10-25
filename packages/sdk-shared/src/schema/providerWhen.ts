import { isEmptyAnswer } from './providerAnswer';
import { GLOBAL_SOURCES } from '../dataSource/globalSources';
import getSourceName from '../dataSource/helpers/getSourceName';
import { isRecord } from '../helpers/isRecord';

import type { RuleGroup, RuleValue } from '../helpers/ruleEvaluator';
import type { Element, SSRUser } from '../types';

/**
 * A provider's `when`: the rule group it waits on before it asks — read the same way by the browser, which waits on it,
 * and by the page server, which resolves a `runtime: 'server'` provider only once its `when` holds. The page server used
 * to resolve every server provider whatever its `when` said (a guest's page resolved what only a signed-in visitor
 * reads), and the browser compared it with the route and query params alone, where authoring writes its fields as
 * sources (`auth.isAuthenticated`, `apiContainer_room.found`).
 */

/** A rule group as a `when` holds it: a combinator and its rules, each a rule or a group. */
export const isRuleGroup = (value: unknown): value is RuleGroup =>
  isRecord(value) &&
  (value.combinator === 'and' || value.combinator === 'or') &&
  Array.isArray(value.rules) &&
  value.rules.every(
    (rule: unknown) =>
      isRuleGroup(rule) || (isRecord(rule) && typeof rule.field === 'string' && typeof rule.operator === 'string')
  );

/** The element's `when`, when it waits on one: a rule group with a rule in it, switched on. */
export const whenOf = (element: Pick<Element, 'attributes'>): RuleGroup | undefined => {
  const { when } = element.attributes;

  return isRuleGroup(when) && when.rules.length > 0 && when.enabled !== false ? when : undefined;
};

/** Every path a rule group reads: each rule's field, and a value that names another path (`isBinding`). */
export const whenPaths = (group: RuleGroup): string[] =>
  group.rules.flatMap(rule =>
    'rules' in rule
      ? whenPaths(rule)
      : [rule.field, ...(rule.isBinding && typeof rule.value === 'string' ? [rule.value] : [])]
  );

const API_SOURCE = 'apiContainer';

/** The sources the page server knows of a visit: where it is, and who is visiting. */
const SERVER_SOURCES: readonly string[] = ['navigation', 'auth'];

/**
 * Whether the page server knows what a path names: where the visit is, who is visiting, a server provider's answer
 * (`serverIds`), or a bare route or query param — what the builder's rule editor writes. A source the browser alone
 * holds — `state`, `variables`, another element's — it cannot.
 */
const serverKnowsPath = (path: string, flat: Record<string, unknown>, serverIds: ReadonlySet<string>): boolean => {
  const [root] = path.split('.');
  if (SERVER_SOURCES.includes(root)) {
    return true;
  }

  if ((GLOBAL_SOURCES as readonly string[]).includes(root)) {
    return false;
  }

  const at = root.indexOf('_');
  const id = at === -1 ? undefined : root.slice(at + 1);
  if (id !== undefined && Object.hasOwn(flat, id)) {
    return root === getSourceName(API_SOURCE, id) && serverIds.has(id);
  }

  return !path.includes('.');
};

/** The paths of a `when` the page server cannot know: what it reads in the browser alone. */
export const whenUnknownToServer = (
  group: RuleGroup,
  flat: Record<string, unknown>,
  serverIds: ReadonlySet<string>
): string[] => [...new Set(whenPaths(group).filter(path => !serverKnowsPath(path, flat, serverIds)))];

/** The server providers a `when` waits on the answer of, by id. */
export const whenProviders = (group: RuleGroup, serverIds: ReadonlySet<string>): string[] => [
  ...new Set(
    whenPaths(group).flatMap(path => {
      const [root] = path.split('.');
      const id = root.startsWith(`${API_SOURCE}_`) ? root.slice(API_SOURCE.length + 1) : undefined;

      return id !== undefined && serverIds.has(id) ? [id] : [];
    })
  )
];

/**
 * A server provider's source as the browser publishes it from the same answer — its own fields and where it stands —
 * so a `when` reading it decides the same on both sides. No answer is a provider that could not be reached.
 */
export const serverProviderSource = (answer: unknown, singleRecord: boolean): Record<string, RuleValue> => {
  if (!isRecord(answer)) {
    return { isLoading: false, isEmpty: true, hasError: true, isStale: false };
  }

  const records = Array.isArray(answer.records) ? answer.records : [];

  return {
    ...answer,
    isLoading: false,
    isEmpty: isEmptyAnswer(answer, records, singleRecord),
    hasError: false,
    isStale: false
  };
};

/** What the page server reads a `when` against: the visit, the visitor, and the answers of server providers so far. */
export const serverWhenValues = ({
  routeParams,
  queryParams,
  pageId,
  user,
  answers
}: {
  routeParams: Record<string, string | undefined>;
  queryParams: Record<string, string>;
  pageId: string;
  user: SSRUser | undefined;
  /** Each server provider resolved before it, by id: its answer and whether it holds one record. */
  answers: Record<string, { answer: unknown; singleRecord: boolean }>;
}): Record<string, RuleValue> => ({
  // The builder's rule editor writes a param by its bare name: read as the browser always did.
  ...routeParams,
  ...queryParams,
  navigation: { routeParams, queryParams, currentPageId: pageId },
  // As the browser's auth source says it (`GlobalSources`): the details of whoever the session names.
  auth: user
    ? {
        isAuthenticated: true,
        status: 'authenticated',
        details: {
          username: user.username,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
          verified: user.verified
        }
      }
    : { isAuthenticated: false, status: 'guest' },
  ...Object.fromEntries(
    Object.entries(answers).map(([id, { answer, singleRecord }]) => [
      getSourceName(API_SOURCE, id),
      serverProviderSource(answer, singleRecord)
    ])
  )
});
