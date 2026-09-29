import { gql } from 'graphql-tag';

const StyleUpdateMutation = gql`
  mutation StyleUpdate($environment: String!, $style: Json!) {
    StyleUpdate(environment: $environment, style: $style) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleUpdateMutation;
