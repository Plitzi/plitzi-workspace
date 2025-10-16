import { gql } from '@apollo/client/core';

export type TSpaceDeployMutation = {
  domain: string;
  revision: number;
  environment: string;
  createdAt: number;
  updatedAt: number;
};

const SpaceDeployMutation = gql`
  mutation SpaceDeploy($environment: String!, $domain: String!, $revision: Int) {
    SpaceDeploy(environment: $environment, domain: $domain, revision: $revision) {
      environment
      domain
      revision
      createdAt
      updatedAt
    }
  }
`;

export default SpaceDeployMutation;
