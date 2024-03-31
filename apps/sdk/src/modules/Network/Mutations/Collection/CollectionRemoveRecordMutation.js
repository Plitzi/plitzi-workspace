// Packages
import { gql } from 'graphql-tag';

const CollectionRemoveRecordMutation = gql`
  mutation CollectionRemoveRecordMutation($id: String!) {
    CollectionRemoveRecord(id: $id) {
      id
      values
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRemoveRecordMutation;
