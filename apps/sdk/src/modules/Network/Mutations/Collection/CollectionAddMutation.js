// Packages
import { gql } from '@apollo/client/core';

const CollectionAddMutation = gql`
  mutation CollectionAddMutation(
    $name: String!
    $namePlural: String!
    $description: String
    $privacy: String!
    $fields: Json!
  ) {
    CollectionAdd(name: $name, namePlural: $namePlural, description: $description, privacy: $privacy, fields: $fields) {
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

export default CollectionAddMutation;
