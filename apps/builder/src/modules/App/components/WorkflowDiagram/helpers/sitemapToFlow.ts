import type { SitemapNode } from '../WorkflowDiagram';
import type { Node, Edge } from '@xyflow/react';

export type AccessLevel = 'none' | 'public' | 'authenticated';

export interface FlowNode extends Node {
  data: {
    label: string;
    accessLevel: 'none' | 'public' | 'authenticated';
    type: 'page' | 'folder';
    path?: string;
    description?: string;
    icon?: string;
    isExpanded?: boolean;
  };
}

const sitemapToFlow = (
  nodes: SitemapNode[],
  parentId: string | null = null,
  level: number = 0,
  xOffset: number = 0
): { nodes: FlowNode[]; edges: Edge[] } => {
  const flowNodes: FlowNode[] = [];
  const flowEdges: Edge[] = [];

  let currentX = xOffset;
  const ySpacing = 200;
  const xSpacing = 250;

  nodes.forEach(node => {
    const nodeId = node.id;
    const y = level * ySpacing;

    flowNodes.push({
      id: nodeId,
      type: 'custom',
      position: { x: currentX, y },
      data: {
        label: node.title,
        accessLevel: node.accessLevel,
        type: node.type,
        path: node.path,
        description: node.description,
        icon: node.icon,
        isExpanded: true
      }
    });

    if (parentId) {
      flowEdges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 2 }
      });
    }

    if (node.type === 'folder' && node.children.length > 0) {
      const childResult = sitemapToFlow(node.children, nodeId, level + 1, currentX);

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
