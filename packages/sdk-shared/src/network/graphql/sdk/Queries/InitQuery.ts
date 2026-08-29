import { gql } from 'graphql-tag';

import type { PluginRaw, SchemaRaw, SegmentRaw, Style } from '../../../../types';

export type TInitQuery = {
  Space?: {
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
    segments?: SegmentRaw[];
    /** What the server decided about this render. Server-side facts the space cannot author away. */
    render?: { overQuota: boolean };
  };
};

const InitQuery = gql`
  query InitQuery($environment: String!, $revision: Int) {
    Space(environment: $environment, revision: $revision) {
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
            }
            attributes
          }
        }
        style {
          cache
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
