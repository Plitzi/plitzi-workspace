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
    $whenYesValue: String
    $whenNoValue: String
  ) {
    SpaceAddVariable(
      environment: $environment
      name: $name
      category: $category
      type: $type
      value: $value
      when: $when
      whenYesValue: $whenYesValue
      whenNoValue: $whenNoValue
    ) {
      name
      category
      type
      value
      when
      whenYesValue
      whenNoValue
    }
  }
`;

export default SpaceAddVariableMutation;
