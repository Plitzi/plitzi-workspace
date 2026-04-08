import { createContext } from 'react';

import type { ElementInteraction, InteractionCallback, Source, SourceField } from '@plitzi/sdk-shared';

export type WorkflowContextValue = {
  direction: 'horizontal' | 'vertical';
  nodeDefinitions?: InteractionCallback[];
  previewData: Record<string, ElementInteraction['preview']>;
  dataSource: Record<string, Source['meta']>;
  dataSourceContent: Record<string, SourceField[]>;
  addNode: (nodeType: ElementInteraction['type'], siblingNodeId?: string, flowId?: string) => void;
  updateNode: (node: ElementInteraction) => void;
  removeNode: (nodeId: string) => void;
  getNode: {
    (nodeId: string): ElementInteraction;
    (): Record<string, ElementInteraction>;
  };
  getDefinition: (
    type: ElementInteraction['type'],
    action: string,
    elementId?: string
  ) => InteractionCallback | undefined;
  moveNode: (nodeId: string, direction?: 'up' | 'down') => void;
  setPreviewNode: (id: string, data?: ElementInteraction['preview']) => void;
};

const workflowContextDefaultValue = {
  direction: 'horizontal'
} as WorkflowContextValue;

const WorkflowContext = createContext(workflowContextDefaultValue);
WorkflowContext.displayName = 'WorkflowContext';

export default WorkflowContext;
