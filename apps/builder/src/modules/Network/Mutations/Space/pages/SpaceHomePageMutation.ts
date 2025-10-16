import { gql } from '@apollo/client/core';

import type { Element } from '@plitzi/sdk-shared';

export type TSpaceHomePageMutation = Element;

const SpaceHomePageMutation = gql`
  mutation SpaceHomePageMutation($environment: String!, $pageId: String!) {
    SpaceHomePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceHomePageMutation;
