import { gql } from 'graphql-tag';

import type { CollectionRecord } from '../../../../../types';

export type TCollectionRemoveRecordMutation = CollectionRecord;

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
