import type { DeployMode, DeployProviderId } from '../../../../../types';

export type TSpaceSetTargetMutation = {
  domain: string;
  mode: DeployMode;
  provider: 'ssr' | DeployProviderId;
  message: string;
};

/** How a domain serves the space: Plitzi's page servers, or a copy of the site on a provider. */
const SpaceSetTargetMutation = /* GraphQL */ `
  mutation SpaceSetTargetMutation(
    $domain: String!
    $mode: String!
    $provider: String
    $config: Json
    $credential: String
    $bucket: Json
  ) {
    SpaceSetTarget(
      domain: $domain
      mode: $mode
      provider: $provider
      config: $config
      credential: $credential
      bucket: $bucket
    )
  }
`;

export default SpaceSetTargetMutation;
