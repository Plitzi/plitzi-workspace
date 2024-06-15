// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableMutation = gql`
  mutation SpaceAddVariableMutation(
    $environment: String!
    $name: String!
    $category: String
    $type: String!
    $value: String
    $when: Json
    $whenSuccessValue: String
    $whenFailValue: String
  ) {
    SpaceAddVariable(
      environment: $environment
      name: $name
      category: $category
      type: $type
      value: $value
      when: $when
      whenSuccessValue: $whenSuccessValue
      whenFailValue: $whenFailValue
    ) {
      name
      category
      type
      value
      when
      whenSuccessValue
      whenFailValue
    }
  }
`;

export default SpaceAddVariableMutation;
