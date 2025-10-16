import { gql } from '@apollo/client/core';

import type { Collection } from '@plitzi/sdk-shared';

export type TCollectionRemoveMutation = Collection;

const CollectionRemoveMutation = gql`
  mutation CollectionRemoveMutation($id: String!) {
    CollectionRemove(id: $id) {
      id
      name
      description
      privacy
      fields
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRemoveMutation;
