// Packages
import { gql } from 'graphql-tag';

const CollectionRemoveMutation = gql`
  mutation CollectionRemoveMutation($id: String!) {
    CollectionRemove(id: $id) {
      id
      name
      description
      fields
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRemoveMutation;
