import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceAddPageMutation = Element;

const SpaceAddPageMutation = gql`
  mutation SpaceAddPageMutation(
    $environment: String!
    $name: String!
    $slug: String!
    $id: String!
    $pageFolder: String
  ) {
    SpaceAddPage(environment: $environment, name: $name, slug: $slug, id: $id, pageFolder: $pageFolder) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceAddPageMutation;
