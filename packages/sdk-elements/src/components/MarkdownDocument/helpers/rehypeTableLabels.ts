import { hastText } from './hastText';

import type { HastNode } from './hastText';

const elementsOf = (node: HastNode | undefined, tagName: string): HastNode[] =>
  (node?.children ?? []).filter(child => child.type === 'element' && child.tagName === tagName);

/**
 * Gives every body cell of a table its column's heading as `data-label`, so a narrow screen can lay a row out as label
 * and value — a table of three columns does not fit a phone, and a row stacked without its headings is a list of words
 * nobody can place.
 */
export const rehypeTableLabels = () => (tree: HastNode) => {
  const visit = (node: HastNode): void => {
    if (node.type === 'element' && node.tagName === 'table') {
      const [head] = elementsOf(node, 'thead');
      const [titles] = elementsOf(head, 'tr');
      const labels = elementsOf(titles, 'th').map(cell => hastText(cell).trim());
      for (const body of elementsOf(node, 'tbody')) {
        for (const row of elementsOf(body, 'tr')) {
          elementsOf(row, 'td').forEach((cell, column) => {
            const label = labels[column];
            if (label) {
              cell.properties = { ...cell.properties, dataLabel: label };
            }
          });
        }
      }
    }

    node.children?.forEach(visit);
  };

  visit(tree);
};
