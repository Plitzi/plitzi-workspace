import { gql } from '@apollo/client/core';

import type { CollectionRaw, PluginRaw, SchemaRaw, SegmentRaw, Style } from '../../../../types';

export type TInitQuery = {
  Space?: {
    definition: SchemaRaw['definition'];
    plugins: PluginRaw[];
    schema: SchemaRaw;
    style: Style;
    segments?: SegmentRaw[];
  };
  Collections: { edges: CollectionRaw[] };
};

const InitQuery = gql`
  query InitQuery($environment: String!, $cursor: String, $limit: Int!) {
    Space(environment: $environment) {
      definition {
        name
        permanentUrl
      }
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
    Collections(cursor: $cursor, limit: $limit) {
      edges {
        id
        name
        namePlural
        description
        privacy
        fields
        records(limit: 20) {
          edges {
            id
            status
            values
            createdAt
            updatedAt
            publishedAt
          }
          pageInfo {
            hasPrevPage
            hasNextPage
            prevCursor
            nextCursor
            from
            to
            total
          }
        }
        createdAt
        updatedAt
      }
    }
  }
`;

export default InitQuery;
