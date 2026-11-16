import type { SpaceScheduledPublish } from '../../../../../types';

export type TSpaceSchedulePublishMutation = Pick<SpaceScheduledPublish, 'id' | 'at' | 'status'>;

/** A publish set for later: at `at` (UTC seconds), with its deploy when it needs one. */
const SpaceSchedulePublishMutation = /* GraphQL */ `
  mutation SpaceSchedulePublishMutation($domain: String!, $environment: String!, $revision: Int!, $at: Int!) {
    SpaceSchedulePublish(domain: $domain, environment: $environment, revision: $revision, at: $at)
  }
`;

export default SpaceSchedulePublishMutation;
