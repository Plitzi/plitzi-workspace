import type { PluginRaw, SchemaRaw, SegmentRaw, Style } from '../../../../types';

export type TInitQuery = {
  Space?: {
    definition: SchemaRaw['definition'];
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
    segments?: SegmentRaw[];
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
      segments {
        id
        identifier
        definition
        schema {
          variables {
            name
            category
            type
            value
            subValues {
              value
              when
            }
          }
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
        }
        style {
          platform
          variables
          mode
          cache
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
