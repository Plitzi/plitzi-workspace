/**
 * What sending one part of a project to its space came to: saved, already the space's, or not — said why; or, with
 * `--dry-run`, `shown`: what would be sent was said, and nothing was.
 */
export type PushOutcome = 'pushed' | 'unchanged' | 'failed' | 'shown';
