/**
 * The two ways part of a page is reused, as the builder shows them wherever it offers them — the canvas overlay, the
 * context menu, the Components panel: one icon and one line each, said once, so the two never end up looking alike.
 *
 * What tells them apart is what happens after: a component stays linked, a snippet is a copy.
 */
export const REUSE = {
  component: { icon: 'fa-solid fa-cube', hint: 'reusable, and editing it updates every instance' },
  snippet: { icon: 'fa-solid fa-object-group', hint: 'a copy to drop anywhere, not linked to where it came from' }
} as const;
