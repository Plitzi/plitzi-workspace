import { hastText } from './hastText';

import type { HastNode } from './hastText';

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** What decides a heading's id: its words, and the ids the document has already given. */
export type HeadingAnchor = (text: string, taken: Set<string>) => string;

/**
 * Gives every heading the id `anchor` answers for its words, in document order — once per parse, so a heading keeps its
 * id however many times React renders it.
 */
export const rehypeHeadingAnchors = (anchor: HeadingAnchor) => () => (tree: HastNode) => {
  const taken = new Set<string>();
  const visit = (node: HastNode): void => {
    if (node.type === 'element' && node.tagName && HEADINGS.has(node.tagName)) {
      node.properties = { ...node.properties, id: anchor(hastText(node).trim(), taken) };
    }

    node.children?.forEach(visit);
  };

  visit(tree);
};
