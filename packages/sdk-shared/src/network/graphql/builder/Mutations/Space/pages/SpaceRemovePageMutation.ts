import type { Element } from '../../../../../../types';

export type TSpaceRemovePageMutation = Element;

const SpaceRemovePageMutation = /* GraphQL */ `
  mutation SpaceRemovePageMutation($environment: String!, $pageId: String!) {
    SpaceRemovePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceRemovePageMutation;
