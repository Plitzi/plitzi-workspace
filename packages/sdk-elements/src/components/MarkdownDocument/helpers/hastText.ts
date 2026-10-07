/** The part of a syntax-tree node this package reads: its words, and the nodes under it. */
export type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** The words under a node, as a reader sees them: text only — a picture's alt and raw HTML are not text. */
export const hastText = (node: HastNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(hastText).join('');
