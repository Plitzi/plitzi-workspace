import { gql } from '@apollo/client/core';

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
