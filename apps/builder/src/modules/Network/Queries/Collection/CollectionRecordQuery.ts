import { gql } from '@apollo/client/core';

const CollectionRecordQuery = gql`
  query CollectionRecordQuery($id: String!, $collectionId: String!) {
    CollectionRecord(id: $id, collectionId: $collectionId) {
      id
      values
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRecordQuery;
