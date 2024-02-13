// Packages
import { gql } from '@apollo/client/core';

const CollectionAddRecordMutation = gql`
  mutation CollectionAddRecordMutation($collectionId: String!, $status: String!, $values: Json!) {
    CollectionAddRecord(collectionId: $collectionId, status: $status, values: $values) {
      id
      status
      values
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

export default CollectionAddRecordMutation;
