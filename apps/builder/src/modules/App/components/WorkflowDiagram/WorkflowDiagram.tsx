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
import { useCallback, useMemo, useState } from 'react';

import { CustomNode } from './components/CustomNode';
import schemaToSitemap from './helpers/schemaToSitemap';
import sitemapToFlow from './helpers/sitemapToFlow';

import type { ElementPage } from './helpers/schemaToSitemap';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

const nodeTypes = {
  custom: CustomNode
};

export type AccessLevel = 'none' | 'public' | 'authenticated';

export type WorkflowNodePage = {
  type: 'page';
  path: string;
};

export type WorkflowNodeFolder = {
  type: 'folder';
  path?: string;
  children: WorkflowNode[];
};

export type WorkflowNode = {
  id: string;
  title: string;
  accessLevel: AccessLevel;
  description?: string;
  icon?: string;
} & (WorkflowNodePage | WorkflowNodeFolder);

export type Template = {
  version: string;
  lastUpdated: Date;
  nodes: WorkflowNode[];
};

export type WorkflowDiagramProps = {
  pages: Element[];
  pageFolders: PageFolder[];
  onAddNode?: (nodeType: 'page' | 'folder' | 'custom') => void;
  onRemoveNode?: (node: WorkflowNode[]) => void;
};

const WorkflowDiagram = ({ pages, pageFolders, onAddNode, onRemoveNode }: WorkflowDiagramProps) => {
  const sitemapNodes = useMemo(() => schemaToSitemap(pages as ElementPage[], pageFolders), [pages, pageFolders]);
  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => sitemapToFlow(sitemapNodes), [sitemapNodes]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => setSelectedNodes(nodes.map(n => n.id)),
    []
  );

  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = sitemapToFlow(sitemapNodes);
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [sitemapNodes, setNodes, setEdges]);

  const handleAddPage = useCallback(() => onAddNode?.('page'), [onAddNode]);

  const handleAddFolder = useCallback(() => onAddNode?.('folder'), [onAddNode]);

  const handleRemoveNode = useCallback(() => {
    const nodesFiltered = selectedNodes
      .map(selectedNode => nodes.find(node => node.id === selectedNode)?.data)
      .filter(Boolean) as WorkflowNode[];
    onRemoveNode?.(nodesFiltered);
  }, [selectedNodes, nodes, onRemoveNode]);

  const getColor = useCallback((node: Node) => {
    const { accessLevel } = node.data;
    switch (accessLevel) {
      case 'public':
        return '#1AC4CA'; // Emerald
      case 'authenticated':
        return '#5900D6'; // Blue
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
      onSelectionChange={handleSelectionChange}
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
          <Card.Body gap={2}>
            <Button size="sm" intent="primary" onClick={handleAddPage} iconPlacement="before">
              <Button.Icon icon="fa-solid fa-plus" />
              Page
            </Button>
            <Button size="sm" intent="secondary" onClick={handleAddFolder} iconPlacement="before">
              <Button.Icon icon="fa-solid fa-plus" />
              Folder
            </Button>
            <Button
              size="sm"
              intent="danger"
              onClick={handleRemoveNode}
              iconPlacement="before"
              disabled={selectedNodes.length === 0}
            >
              <Button.Icon icon="fa-solid fa-trash-can" />
              {`Remove ${selectedNodes.length > 0 ? `(${selectedNodes.length})` : ''}`}
            </Button>
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
