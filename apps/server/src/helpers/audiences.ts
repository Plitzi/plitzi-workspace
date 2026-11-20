import { requestAuthority } from '@plitzi/sdk-kernel/http';
import { audienceFactsUsed, audienceKeyOf, AUDIENCE_TYPE, visitorFactsOf } from '@plitzi/sdk-shared/audiences';

import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Schema } from '@plitzi/sdk-shared';
import type { VisitorFact, VisitorFacts } from '@plitzi/sdk-shared/audiences';

/** What the experiments are read off: the pages' tree and the components'. */
type SpaceTrees = Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>;

type SpaceAudiences = { has: boolean; used: VisitorFact[] };

/** Read once per space as it was read: the object is shared by every render of a revision (the offline-data cache). */
const audiencesOf = new WeakMap<SpaceTrees, SpaceAudiences>();

/** Whether a space has audiences at all, and the visitor facts their rules read. */
export const spaceAudiences = (schema: SpaceTrees): SpaceAudiences => {
  const known = audiencesOf.get(schema);
  if (known) {
    return known;
  }

  const trees = [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)];
  const found = {
    has: trees.some(flat => Object.values(flat).some(element => element.definition.type === AUDIENCE_TYPE)),
    used: audienceFactsUsed(schema)
  };
  audiencesOf.set(schema, found);

  return found;
};

const headerOf = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** This request's visitor, as an audience's rules read them: their first visit's cookie, their agent, their languages. */
export const requestVisitorFacts = (req: Pick<SSRRequest, 'headers'>): VisitorFacts =>
  visitorFactsOf({
    cookies: req.headers.cookie,
    host: requestAuthority(req),
    userAgent: headerOf(req.headers['user-agent']),
    mobileHint: headerOf(req.headers['sec-ch-ua-mobile']),
    acceptLanguage: headerOf(req.headers['accept-language']),
    now: Date.now()
  });

/**
 * What a page of this space is kept apart by for this request, asked before the cache is: the facts its audiences read,
 * from the space this server holds already. `undefined` when it holds none — the render that reads it keeps nothing.
 */
export const audienceKeyFor = (req: Pick<SSRRequest, 'headers'>, held: SpaceTrees | undefined): string | undefined => {
  if (!held) {
    return undefined;
  }

  const { used } = spaceAudiences(held);

  return used.length > 0 ? audienceKeyOf(requestVisitorFacts(req), used) : '';
};
