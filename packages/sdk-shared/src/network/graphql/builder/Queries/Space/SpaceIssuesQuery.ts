/** One thing the saved space would render wrong; `elementId` is the element to take someone to, when it has one. */
export type TSpaceIssue = {
  code: string;
  message: string;
  elementId: string | null;
  fixable: boolean;
  /** What to write instead, from the row of its code — Markdown with `code` in backticks; null when it has no row. */
  fix: string | null;
};

/** A shorter way to the same page — not a problem: the space renders as written. */
export type TSpaceSuggestion = {
  code: string;
  message: string;
  /** The elements it is about — the copies, the buttons. */
  elementIds: string[];
  /** How many elements taking it would save. */
  saves: number;
  /** The short way, from the row of its code — Markdown with `code` in backticks. */
  fix: string | null;
};

/** `errors` block publishing; `warnings` render, but most likely not as meant; `suggestions` are a shorter way. */
export type TSpaceIssues = { errors: TSpaceIssue[]; warnings: TSpaceIssue[]; suggestions: TSpaceSuggestion[] };

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
      suggestions {
        code
        message
        elementIds
        saves
        fix
      }
    }
  }
`;

export default SpaceIssuesQuery;
