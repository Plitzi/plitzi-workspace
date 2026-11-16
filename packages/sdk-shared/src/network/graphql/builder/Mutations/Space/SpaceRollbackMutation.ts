import type { SpaceDeployment } from '../../../../../types';

export type TSpaceRollbackMutation = SpaceDeployment;

/** Rolls a domain back: to what it served right before its latest release, or the version named. */
const SpaceRollbackMutation = /* GraphQL */ `
  mutation SpaceRollbackMutation($domain: String!, $environment: String, $revision: Int) {
    SpaceRollback(domain: $domain, environment: $environment, revision: $revision) {
      id
      environment
      domain
      revision
      isVerified
      default
      credential {
        identifier
      }
      createdAt
      updatedAt
    }
  }
`;

export default SpaceRollbackMutation;
