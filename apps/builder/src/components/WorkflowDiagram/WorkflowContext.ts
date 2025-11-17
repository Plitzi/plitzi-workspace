import { createContext } from 'react';

import type { RefObject } from 'react';

export type WorkflowDirection = 'horizontal' | 'vertical';
export type ConnectorPlacement = 'top' | 'bottom' | 'left' | 'right';
export type ConnectorMode = 'in' | 'out';

export type Connector = {
  id: string;
  limit?: number;
  mode: ConnectorMode;
  placement: ConnectorPlacement;
};

export type NodeConnection = {
  id: string;
  title: string;
  type: 'connector';
  from: { id: string; connector: Connector['id'] };
  to: { id: string; connector: Connector['id'] };
  position: { x: number; y: number };
};

export type NodeNormal = {
  id: string;
  title?: string;
  type: 'trigger' | 'callback';
  action: string;
  position: { x: number; y: number };
  connectors: Record<string, Connector>;
};

export type Node = NodeNormal | NodeConnection;

export type WorkflowContextValue = {
  nodes: Record<string, Node>;
  direction: WorkflowDirection;
  containerRef: RefObject<HTMLDivElement | null>;
  nodeDefinitions?: object[];
  registerNode: (node: Node) => void;
  unregisterNode: (nodeId: string) => void;
  updateNode: (node: Node, reset?: boolean) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateNodeConnector: (nodeId: string, connector: Connector) => void;
  getNode: (nodeId: string) => Node;
  bindNodes: (nodeFromId: string, nodeToId: string, connectorFromId: string, connectorToId: string) => void;
  wipeNodes: () => void;
  performLayout: (direction?: WorkflowDirection) => void;
};

const WorkflowContext = createContext<WorkflowContextValue>({} as WorkflowContextValue);

export default WorkflowContext;
