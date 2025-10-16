import { gql } from 'graphql-tag';

const CollectionUpdateRecordMutation = gql`
  mutation CollectionUpdateRecordMutation($id: String!, $status: String!, $values: Json!) {
    CollectionUpdateRecord(id: $id, status: $status, values: $values) {
      id
      status
      values
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

export default CollectionUpdateRecordMutation;
