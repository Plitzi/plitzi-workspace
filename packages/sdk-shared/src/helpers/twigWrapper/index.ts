// A small template engine for `{{ token }}` interpolation plus a single-level `{% if %}` — the syntax the
// platform's user-written templates use (data-source and interaction transformers). It replaces the twig library;
// its behaviour is pinned by twigWrapper.contract.test.ts, captured from the previous twig-backed implementation.
export { processTwig } from './processTwig';
export { hasValidToken } from './tokens/hasValidToken';
export { filters } from './filters/filters';

export type { TwigFilter } from './filters/filters';
