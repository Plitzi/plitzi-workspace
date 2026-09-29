import type { Element } from '../../../../../../types';

export type TSpaceHomePageMutation = Element;

const SpaceHomePageMutation = /* GraphQL */ `
  mutation SpaceHomePageMutation($environment: String!, $pageId: String!) {
    SpaceHomePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceHomePageMutation;
