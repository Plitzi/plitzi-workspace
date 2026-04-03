import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceHomePageMutation = Element;

const SpaceHomePageMutation = gql`
  mutation SpaceHomePageMutation($environment: String!, $pageId: String!) {
    SpaceHomePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceHomePageMutation;
