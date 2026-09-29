const StyleUpdateMutation = /* GraphQL */ `
  mutation StyleUpdateMutation($environment: String!, $style: Json!) {
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
