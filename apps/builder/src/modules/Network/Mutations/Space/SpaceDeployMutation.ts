import { gql } from '@apollo/client/core';

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
