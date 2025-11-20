import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  // type Edge,
  Panel
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import { CustomNode } from './components/CustomNode';
import schemaToSitemap from './helpers/schemaToSitemap';
import sitemapToFlow from './helpers/sitemapToFlow';

import type { ElementPage } from './helpers/schemaToSitemap';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

const nodeTypes = {
  custom: CustomNode
};

export type AccessLevel = 'none' | 'public' | 'authenticated';

export type SitemapPage = {
  type: 'page';
  path: string;
};

export type SitemapFolder = {
  type: 'folder';
  path?: string;
  children: SitemapNode[];
};

export type SitemapNode = {
  id: string;
  title: string;
  accessLevel: AccessLevel;
  description?: string;
  icon?: string;
} & (SitemapPage | SitemapFolder);

export type Template = {
  version: string;
  lastUpdated: Date;
  nodes: SitemapNode[];
};

export type WorkflowDiagramProps = {
  pages: Element[];
  pageFolders: PageFolder[];
};

const WorkflowDiagram = ({ pages, pageFolders }: WorkflowDiagramProps) => {
  const sitemapNodes = useMemo(() => schemaToSitemap(pages as ElementPage[], pageFolders), [pages, pageFolders]);
  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => sitemapToFlow(sitemapNodes), [sitemapNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = sitemapToFlow(sitemapNodes);
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [sitemapNodes, setNodes, setEdges]);

  const getColor = useCallback((node: Node) => {
    const { accessLevel } = node.data;
    switch (accessLevel) {
      case 'public':
        return '#10b981'; // Emerald
      case 'authenticated':
        return '#3b82f6'; // Blue
      default:
        return '#64748b'; // Slate
    }
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#94a3b8" gap={16} />
      <Controls />
      <MiniMap nodeColor={getColor} className="bg-background! border" />

      <Panel position="top-left" className="space-x-2">
        <Card className="flex gap-2 p-2">
          <Card.Body>
            <Button size="sm" intent="custom" onClick={handleAutoLayout} iconPlacement="before">
              <Button.Icon icon="fa-solid fa-border-all" />
              Auto Layout
            </Button>
          </Card.Body>
        </Card>
      </Panel>

      <Panel position="top-right" className="space-y-2">
        <Card className="space-y-2 p-3">
          <Card.Header>
            <h3 className="text-sm font-semibold">Access Levels</h3>
          </Card.Header>
          <Card.Body>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-xs">Public</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-xs">Authenticated</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-500" />
                <span className="text-xs">None</span>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Panel>
    </ReactFlow>
  );
};

export default WorkflowDiagram;
