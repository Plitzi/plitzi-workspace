import type { PageInfo } from './CollectionTypes';
import type { Element, Schema, SchemaRaw, SchemaVariable } from './SchemaTypes';
import type { Style } from './StyleTypes';

export type Segment = {
  id: string;
  definition: {
    name: string;
    description: string;
    baseElementId: Element['id'];
  };
  environment: 'main' | 'development' | 'staging' | 'production';
  schema: Schema;
  style: Style;
  identifier: string;
};

export type BuilderSegmentsContextValue = {
  segments: Record<string, Segment>;
  dispatchSegments?: unknown;
  segmentGet: (identifier: string) => Promise<Segment | undefined>;
  segmentsFetch: (
    filter?: string | object,
    cursor?: string,
    limit?: number
  ) => Promise<{ edges: Segment[]; pageInfo: PageInfo } | undefined | null>;
  segmentsAdd: (segment: Segment) => void;
  segmentsUpdate: (segment: Segment) => void;
  segmentsRemove: (id: Segment['id']) => void;
  elementAsSegment: (
    schema: Schema,
    style: Style,
    name: string,
    description: string,
    element: Element
  ) => Promise<void>;
  segmentAddMutation: (
    name: string,
    description: string,
    schema?: Schema,
    style?: Style,
    variables?: SchemaVariable[]
  ) => Promise<void>;
};

export type SegmentsContextValue<T extends 'builder' | 'sdk' = 'sdk'> = T extends 'builder'
  ? BuilderSegmentsContextValue
  : Pick<BuilderSegmentsContextValue, 'segments' | 'segmentGet'>;

// Raws

export type SegmentRaw = {
  id: string;
  definition: {
    name: string;
    description: string;
    baseElementId: Element['id'];
  };
  environment: 'main' | 'development' | 'staging' | 'production';
  schema: SchemaRaw;
  style: Style;
  identifier: string;
};
