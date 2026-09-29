import { gql } from 'graphql-tag';

import type { PageFolder } from '../../../../../../types';

export type TSpaceUpdatePageFolderMutation = PageFolder;

const SpaceUpdatePageFolderMutation = gql`
  mutation SpaceUpdatePageFolderMutation($environment: String!, $pageFolder: Json!) {
    SpaceUpdatePageFolder(environment: $environment, pageFolder: $pageFolder) {
      id
      name
      slug
      parentId
    }
  }
`;

export default SpaceUpdatePageFolderMutation;
