import type { SpaceScheduledPublish } from '../../../../../types';

export type TSpaceScheduledPublishesQuery = { SpaceScheduledPublishes: SpaceScheduledPublish[] };

/** The space's publishes set for later, soonest first, and the ones that ran lately. */
const SpaceScheduledPublishesQuery = /* GraphQL */ `
  query SpaceScheduledPublishesQuery {
    SpaceScheduledPublishes
  }
`;

export default SpaceScheduledPublishesQuery;
