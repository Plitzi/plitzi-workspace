import type { PluginRaw, SchemaRaw, Style } from '../../../../types';

export type TInitQuery = {
  Space?: {
    definition: SchemaRaw['definition'];
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
  };
};

const InitQuery = /* GraphQL */ `
  query InitQuery($environment: String!, $revision: Int) {
    Space(environment: $environment, revision: $revision) {
      definition {
        name
        permanentUrl
      }
      schema {
        settings
        rsc
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
            runtime
            loadStrategy
          }
          attributes
        }
        pages
        components
        pageFolders {
          id
          name
          slug
          parentId
        }
        variables {
          name
          category
          type
          value
          subValues {
            when
            value
          }
        }
      }
      plugins {
        type
        resource
        settings
      }
      style {
        id
        platform
        variables
        mode
        fonts
        cache
      }
    }
  }
`;

export default InitQuery;
