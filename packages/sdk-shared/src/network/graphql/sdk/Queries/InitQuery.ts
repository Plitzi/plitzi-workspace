import type { PluginRaw, SchemaRaw, Style } from '../../../../types';

export type TInitQuery = {
  Space?: {
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
    /** What the server decided about this render. Server-side facts the space cannot author away. */
    render?: { overQuota: boolean };
  };
};

const InitQuery = /* GraphQL */ `
  query InitQuery($environment: String!, $revision: Int) {
    Space(environment: $environment, revision: $revision) {
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
        variables
        cache
      }
      # The schema fetch is the one moment a client-side render hears from the server at all, so the decision it
      # would have been handed in an SSR bootstrap travels here instead.
      render {
        overQuota
      }
    }
  }
`;

export default InitQuery;
