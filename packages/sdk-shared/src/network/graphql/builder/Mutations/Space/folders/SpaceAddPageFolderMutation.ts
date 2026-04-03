import { gql } from '@apollo/client/core';

import type { PageFolder } from '../../../../../../types';

export type TSpaceAddPageFolderMutation = PageFolder;

const SpaceAddPageFolderMutation = gql`
  mutation SpaceAddPageFolderMutation($environment: String!, $name: String!, $slug: String!, $parentId: String) {
    SpaceAddPageFolder(environment: $environment, name: $name, slug: $slug, parentId: $parentId) {
      id
      name
      slug
      parentId
    }
  }
`;

export default SpaceAddPageFolderMutation;
