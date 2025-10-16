import { gql } from 'graphql-tag';

import type { CollectionRaw, PluginRaw, SchemaRaw, SegmentRaw, Style } from '@plitzi/sdk-shared';

export type TInitQuery = {
  Space?: {
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
    segments?: SegmentRaw[];
  };
  Collections: { edges: CollectionRaw[] };
};

const InitQuery = gql`
  query InitQuery($environment: String!, $revision: Int, $limit: Int!) {
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
        cache
      }
    }
    Collections(limit: $limit) {
      edges {
        id
        name
        namePlural
        description
        privacy
        fields
        createdAt
        updatedAt
      }
    }
  }
`;

export default InitQuery;
