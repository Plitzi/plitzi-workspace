import type { WorkflowNode } from '../WorkflowDiagram';
import type { Node, Edge } from '@xyflow/react';

export type AccessLevel = 'none' | 'public' | 'authenticated';

export interface FlowNode extends Node {
  data: {
    id: string;
    title: string;
    accessLevel: 'none' | 'public' | 'authenticated';
    type: 'page' | 'folder';
    path?: string;
    description?: string;
    icon?: string;
    isExpanded?: boolean;
  };
}

const sitemapToFlow = (
  nodes: WorkflowNode[],
  parentId: string | null = null,
  level: number = 0,
  xOffset: number = 0
): { nodes: FlowNode[]; edges: Edge[] } => {
  const flowNodes: FlowNode[] = [];
  const flowEdges: Edge[] = [];

  let currentX = xOffset;
  const ySpacing = 210;
  const xSpacing = 250;

  nodes.forEach(node => {
    const { id, title, accessLevel, type, path, description, icon } = node;
    const y = level * ySpacing;

    flowNodes.push({
      id,
      type: 'custom',
      position: { x: currentX, y },
      data: { id, title, accessLevel, type, path, description, icon, isExpanded: true }
    });

    if (parentId) {
      flowEdges.push({
        id: `${parentId}-${id}`,
        source: parentId,
        target: id,
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 2 }
      });
    }

    if (type === 'folder' && node.children.length > 0) {
      const childResult = sitemapToFlow(node.children, id, level + 1, currentX);
      flowNodes.push(...childResult.nodes);
      flowEdges.push(...childResult.edges);
      const childrenWidth = childResult.nodes.filter(node => node.data.type !== 'folder').length * xSpacing;
      currentX += Math.max(xSpacing, childrenWidth);
    } else {
      currentX += xSpacing;
    }
  });

  return { nodes: flowNodes, edges: flowEdges };
};

export default sitemapToFlow;
