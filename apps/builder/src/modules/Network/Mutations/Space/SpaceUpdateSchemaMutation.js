// Packages
import { gql } from '@apollo/client/core';

const SpaceUpdateSchemaMutation = gql`
  mutation SpaceUpdateSchema($environment: String!, $schema: Json!) {
    SpaceUpdateSchema(environment: $environment, schema: $schema) {
      schema {
        settings
        flat {
          id
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
  }
`;

export default SpaceUpdateSchemaMutation;
