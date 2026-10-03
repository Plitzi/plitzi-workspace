/**
 * What an element's `anchor` may be: the `id` it carries in the DOM, so `/page#anchor` lands on it.
 *
 * Lowercase, starting with a letter, then letters, digits and hyphens — a fragment a person types in a URL, with no
 * escaping and no case to get wrong. The one rule the authoring package, the builder and the MCP all hold it to.
 */
export const ANCHOR_PATTERN = /^[a-z][a-z0-9-]*$/;

export const isAnchor = (value: unknown): value is string => typeof value === 'string' && ANCHOR_PATTERN.test(value);
