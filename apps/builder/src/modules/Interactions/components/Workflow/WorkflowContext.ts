import { createContext } from 'react';

import type { ElementInteraction, InteractionCallback, Source, SourceField } from '@plitzi/sdk-shared';

/** An element of the space a step param can name, as the element picker lists it. */
export type WorkflowElement = { id: string; type: string; label: string };

export type WorkflowContextValue = {
  direction: 'horizontal' | 'vertical';
  nodeDefinitions?: InteractionCallback[];
  previewData: Record<string, ElementInteraction['preview']>;
  dataSource: Record<string, Source['meta']>;
  dataSourceContent: Record<string, SourceField[]>;
  /** The space's elements, for a param that picks some of them. */
  elements: WorkflowElement[];
  addNode: (nodeType: ElementInteraction['type'], siblingNodeId?: string, flowId?: string) => void;
  updateNode: (node: ElementInteraction) => void;
  removeNode: (nodeId: string) => void;
  getNode: {
    (nodeId: string): ElementInteraction;
    (): Record<string, ElementInteraction>;
  };
  getPreviousNodes: (nodeId: string, skipTrigger?: boolean) => ElementInteraction[];
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
