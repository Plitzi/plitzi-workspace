import type { SpacePublishCheck } from '../../../../../types';

export type TSpacePublishCheckQuery = { SpacePublishCheck: SpacePublishCheck };

/** What publishing a revision on a domain would do — whether it needs a deploy, and why — before it does. */
const SpacePublishCheckQuery = /* GraphQL */ `
  query SpacePublishCheckQuery($domain: String!, $environment: String!, $revision: Int) {
    SpacePublishCheck(domain: $domain, environment: $environment, revision: $revision)
  }
`;

export default SpacePublishCheckQuery;
