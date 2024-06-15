// Packages
import { gql } from 'graphql-tag';

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
