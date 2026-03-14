import { gql } from 'graphql-tag';

import type { CollectionRecord } from '../../../../../types';

export type TCollectionAddRecordMutation = CollectionRecord;

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
