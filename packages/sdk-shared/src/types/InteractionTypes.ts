// Types
import type { ElementInteraction } from './SchemaTypes';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type InteractionStatus = 'completed' | 'skipped';
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled';

export type InteractionNode = {
  node: ElementInteraction;
  status: InteractionNodeStatus;
  postCallbacks: unknown[];
  result?: unknown;
  startTime: number;
  endTime: number;
  whenParams?: Record<string, RuleValue>;
};
