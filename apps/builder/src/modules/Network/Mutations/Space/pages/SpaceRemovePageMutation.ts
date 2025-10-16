import { gql } from '@apollo/client/core';

import type { Element } from '@plitzi/sdk-shared';

export type TSpaceRemovePageMutation = Element;

const SpaceRemovePageMutation = gql`
  mutation SpaceRemovePageMutation($environment: String!, $pageId: String!) {
    SpaceRemovePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceRemovePageMutation;
