import type { Element } from '../../../../../../types';

export type TSpaceUpdatePageMutation = Element;

const SpaceUpdatePageMutation = /* GraphQL */ `
  mutation SpaceUpdatePageMutation($environment: String!, $page: Json!) {
    SpaceUpdatePage(environment: $environment, page: $page) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceUpdatePageMutation;
