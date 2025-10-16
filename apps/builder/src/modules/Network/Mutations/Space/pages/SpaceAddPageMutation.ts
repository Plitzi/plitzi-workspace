import { gql } from '@apollo/client/core';

import type { Element } from '@plitzi/sdk-shared';

export type TSpaceAddPageMutation = Element;

const SpaceAddPageMutation = gql`
  mutation SpaceAddPageMutation($environment: String!, $name: String!, $pageFolder: String) {
    SpaceAddPage(environment: $environment, name: $name, pageFolder: $pageFolder) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceAddPageMutation;
