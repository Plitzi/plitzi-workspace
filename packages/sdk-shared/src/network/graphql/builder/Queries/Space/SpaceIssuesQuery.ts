import { gql } from '@apollo/client/core';

/** One thing the saved space would render wrong; `elementId` is the element to take someone to, when it has one. */
export type TSpaceIssue = { code: string; message: string; elementId: string | null; fixable: boolean };

/** `errors` block publishing; `warnings` render, but most likely not as meant. */
export type TSpaceIssues = { errors: TSpaceIssue[]; warnings: TSpaceIssue[] };

export type TSpaceIssuesQuery = { SpaceIssues: TSpaceIssues | null };

const SpaceIssuesQuery = gql`
  query SpaceIssuesQuery($environment: String!) {
    SpaceIssues(environment: $environment) {
      errors {
        code
        message
        elementId
        fixable
      }
      warnings {
        code
        message
        elementId
        fixable
      }
    }
  }
`;

export default SpaceIssuesQuery;
