import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceUpdatePageMutation = Element;

const SpaceUpdatePageMutation = gql`
  mutation SpaceUpdatePageMutation($environment: String!, $page: Json!) {
    SpaceUpdatePage(environment: $environment, page: $page) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceUpdatePageMutation;
