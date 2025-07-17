import type { Element, Schema } from './SchemaTypes';
import type { Style } from './StyleTypes';

export type Segment = {
  id?: string;
  definition: {
    name: string;
    description: string;
    baseElementId: Element['id'];
  };
  environment: 'main' | 'development' | 'staging' | 'production';
  schema: Schema;
  style: Style;
  identifier: string;
} & {
  [K in Exclude<string, 'style' | 'schema' | 'definition' | 'environment' | 'identifier'>]: unknown;
};

export type SegmentsContextValue = {
  segments: Record<string, Segment>;
  dispatchSegments?: unknown;
  segmentGet: (identifier: string) => Promise<Segment>;
  segmentsFetch: (filter?: string, cursor?: string, limit?: number) => Promise<Segment[]>;
  segmentsAdd?: unknown;
  segmentsUpdate?: unknown;
  segmentsRemove?: unknown;
  segmentAddElement?: unknown;
  segmentUpdateElement?: unknown;
  segmentMoveElement?: unknown;
  segmentRemoveElement?: unknown;
  segmentAddSelector?: unknown;
  segmentUpdateSelector?: unknown;
  segmentRemoveSelector?: unknown;
  segmentAddVariable?: unknown;
  segmentUpdateVariable?: unknown;
  segmentRemoveVariable?: unknown;
  segmentAddTemplate?: unknown;
  elementAsSegment?: unknown;
  segmentAddMutation?: unknown;
};
