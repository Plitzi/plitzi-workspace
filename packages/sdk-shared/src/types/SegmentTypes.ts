import type { Element, Schema } from './SchemaTypes';

export type Segment = {
  attributes: Element['attributes'];
  definition: Element['definition'];
  schema: Schema;
} & Record<string, unknown>;

export type SegmentsContextValue = {
  segments: Record<string, Segment>;
  dispatchSegments?: unknown;
  segmentGet: (identifier: string) => Promise<Segment>;
  segmentsFetch?: unknown;
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
