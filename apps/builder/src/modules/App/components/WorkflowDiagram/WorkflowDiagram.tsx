import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, Panel } from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import CustomEdge from './components/CustomEdge';
import CustomNode from './components/CustomNode';
import schemaToSitemap from './helpers/schemaToSitemap';
import sitemapToFlow from './helpers/sitemapToFlow';

import type { ElementPage } from './helpers/schemaToSitemap';
import type { FlowNode } from './helpers/sitemapToFlow';
import type { Element, PageFolder } from '@plitzi/sdk-shared';
import type { Node, Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';

export type { Connection, Edge, Node, FlowNode };

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
  onAddEdge?: (edge: Connection) => void;
  onRemoveEdge?: (edge: Connection | Edge) => void;
  onRemoveNode?: (node: Node) => void;
};

const nodeTypes = { custom: CustomNode };

const edgeTypes = { customEdge: CustomEdge };

const WorkflowDiagram = ({
  pages,
  pageFolders,
  onAddNode,
  onAddEdge,
  onRemoveNode,
  onRemoveEdge
}: WorkflowDiagramProps) => {
  const sitemapNodes = useMemo(() => schemaToSitemap(pages as ElementPage[], pageFolders), [pages, pageFolders]);
  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => sitemapToFlow(sitemapNodes), [sitemapNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useDidUpdateEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [setNodes, flowNodes]);

  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = sitemapToFlow(sitemapNodes);
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [sitemapNodes, setNodes, setEdges]);

  const handleAddPage = useCallback(() => onAddNode?.('page'), [onAddNode]);

  const handleAddFolder = useCallback(() => onAddNode?.('folder'), [onAddNode]);

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

  const handleIsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (edges.some(e => e.target === connection.target && e.source === connection.source)) {
        return false;
      }

      if (edges.some(e => e.target === connection.target)) {
        // target has an edge already
        return false;
      }

      return true;
    },
    [edges]
  );

  const handleConnect = useCallback((connection: Connection) => onAddEdge?.(connection), [onAddEdge]);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      changes.forEach(change => {
        if (change.type === 'remove') {
          const edge = edges.find(edge => edge.id === change.id);
          if (edge) {
            onRemoveEdge?.(edge);
          }
        }
      });

      onEdgesChange(changes);
    },
    [edges, onEdgesChange, onRemoveEdge]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      changes.forEach(change => {
        if (change.type === 'remove') {
          const node = nodes.find(node => node.id === change.id);
          if (node) {
            onRemoveNode?.(node);
          }
        }
      });

      onNodesChange(changes);
    },
    [nodes, onNodesChange, onRemoveNode]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      isValidConnection={handleIsValidConnection}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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
