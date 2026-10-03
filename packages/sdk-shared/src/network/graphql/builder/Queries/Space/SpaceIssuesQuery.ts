/** One thing the saved space would render wrong; `elementId` is the element to take someone to, when it has one. */
export type TSpaceIssue = {
  code: string;
  message: string;
  elementId: string | null;
  fixable: boolean;
  /** What to write instead, from the row of its code — Markdown with `code` in backticks; null when it has no row. */
  fix: string | null;
};

/** `errors` block publishing; `warnings` render, but most likely not as meant. */
export type TSpaceIssues = { errors: TSpaceIssue[]; warnings: TSpaceIssue[] };

export type TSpaceIssuesQuery = { SpaceIssues: TSpaceIssues | null };

const SpaceIssuesQuery = /* GraphQL */ `
  query SpaceIssuesQuery($environment: String!) {
    SpaceIssues(environment: $environment) {
      errors {
        code
        message
        elementId
        fixable
        fix
      }
      warnings {
        code
        message
        elementId
        fixable
        fix
      }
    }
  }
`;

export default SpaceIssuesQuery;
