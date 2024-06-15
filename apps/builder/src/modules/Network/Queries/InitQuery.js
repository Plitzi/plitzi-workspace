// Packages
import { gql } from '@apollo/client/core';

const InitQuery = gql`
  query InitQuery($environment: String!, $cursor: String, $limit: Int!) {
    Space(environment: $environment) {
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
          when
          whenSuccessValue
          whenFailValue
        }
      }
      segments {
        id
        identifier
        definition
        schema {
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
        cache
      }
    }
    Templates(limit: $limit) {
      edges {
        id
        definition
        schema
        style
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
            values
            createdAt
            updatedAt
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
