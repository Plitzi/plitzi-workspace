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
            flag {
              name
              is
            }
            anchor
            motion {
              enter
              on
              duration
              delay
              stagger
              loop
            }
            quiet
          }
          attributes
        }
        pages
        components
        flags
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
