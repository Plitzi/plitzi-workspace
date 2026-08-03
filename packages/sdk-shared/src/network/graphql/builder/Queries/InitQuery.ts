import { gql } from '@apollo/client/core';

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

const InitQuery = gql`
  query InitQuery($environment: String!, $revision: Int) {
    Space(environment: $environment, revision: $revision) {
      definition {
        name
        permanentUrl
      }
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
        cache
      }
    }
  }
`;

export default InitQuery;
