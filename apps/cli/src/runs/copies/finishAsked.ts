/** What a `run finish` is asked: written or only checked, and how. */
export interface FinishAsked {
  /** Written into the project — a person's, or the lead's once allowed; a dry run otherwise. */
  apply: boolean;
  /** Finished without the tasks not done, said as such. */
  leavePending: boolean;
  /** The project's files as they were kept in `tmp/plitzi-backups/`. */
  backup?: boolean;
  /** Every line run, never stopped at the first that fails twice: each failure said at once (`--every-line`). */
  everyLine?: boolean;
}
