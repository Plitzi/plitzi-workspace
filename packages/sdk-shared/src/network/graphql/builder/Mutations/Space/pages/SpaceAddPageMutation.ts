import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceAddPageMutation = Element;

const SpaceAddPageMutation = gql`
  mutation SpaceAddPageMutation(
    $environment: String!
    $name: String!
    $slug: String!
    $idRef: String!
    $pageFolder: String
  ) {
    SpaceAddPage(environment: $environment, name: $name, slug: $slug, idRef: $idRef, pageFolder: $pageFolder) {
      id
      idRef
      definition
      attributes
    }
  }
`;

export default SpaceAddPageMutation;
