/**
 * What Plitzi was told and decided not to change, each with why and what to do instead — so a report does not carry it
 * again as open, and a finding that does bring something new says what is new. One owner: this list, shown to the agent
 * that writes a report (`feedbackBrief`). A decision undone is taken out; a new one is added with the release that
 * makes it.
 */
export interface Decision {
  /** What a report would say, in a few words. */
  subject: string;
  /** What Plitzi does, and why it stays so. */
  decided: string;
  /** What a project does instead. */
  instead: string;
}

export const DECIDED: readonly Decision[] = [
  {
    subject: 'An import of a FILE of a package fails with Node’s own ERR_MODULE_NOT_FOUND, naming nothing of Plitzi',
    decided:
      'a package is imported by its root and its folders, never by a file (0.38.17); no stub is published per old file to change Node’s message — a shim that would stay forever',
    instead:
      '`plitzi doctor` names each such import (`import-not-exported`); `plitzi upgrade migrations --write` rewrites it to its folder'
  },
  {
    subject: '`plitzi upgrade migrations` no longer looks for the changes of 0.38.0, 0.38.9 and 0.38.12',
    decided:
      'a migration stays while a project may still be on a version before it; those (the `*Template` names, an optional `formControl`, `usePlitziServiceContext` → `usePlitzi`) were retired in 0.38.17',
    instead: 'a project still on one of those versions makes the change by hand, as the CHANGELOG of 0.38.17 says'
  },
  {
    subject: 'No `plitzi link` to point a project at an unreleased Plitzi',
    decided: 'a project runs the published packages; an unreleased Plitzi is not something a customer has to point at',
    instead: 'report against the published version, and try the next one once it is released (`plitzi upgrade`)'
  }
];
