import type { SpaceDeploySummary } from '../../../../../types';

export type TSpaceRedeployMutation = SpaceDeploySummary;

/** Deploys again what a target serves — `redeploy` brings it to the newest versions. */
const SpaceRedeployMutation = /* GraphQL */ `
  mutation SpaceRedeployMutation($domain: String!, $kind: String) {
    SpaceRedeploy(domain: $domain, kind: $kind)
  }
`;

export default SpaceRedeployMutation;
