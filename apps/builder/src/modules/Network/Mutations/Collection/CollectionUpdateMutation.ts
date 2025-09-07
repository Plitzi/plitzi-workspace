import { gql } from '@apollo/client/core';

const CollectionUpdateMutation = gql`
  mutation CollectionUpdateMutation(
    $id: String!
    $name: String!
    $namePlural: String!
    $description: String
    $privacy: String!
    $fields: Json!
  ) {
    CollectionUpdate(
      id: $id
      name: $name
      namePlural: $namePlural
      description: $description
      privacy: $privacy
      fields: $fields
    ) {
      id
      name
      namePlural
      description
      privacy
      fields
      createdAt
      updatedAt
    }
  }
`;

export default CollectionUpdateMutation;
