import { gql } from '@apollo/client/core';

const SpaceUpdateMutation = gql`
  mutation SpaceUpdate($environment: String!, $schema: Json!, $styleId: String!, $style: Json!) {
    SpaceUpdateSchema(environment: $environment, schema: $schema) {
      schema {
        settings
        flat {
          id
          idRef
          definition {
            label
            type
            initialState
            styleSelectors
            bindings
            interactions
            parentId
            rootId
            items
          }
          attributes
        }
        pages
      }
    }
    StyleUpdate(id: $styleId, environment: $environment, style: $style) {
      id
      platform
      cache
    }
  }
`;

export default SpaceUpdateMutation;
