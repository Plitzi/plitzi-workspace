import type { DropPosition, Element, Schema, SchemaRaw, SchemaVariable } from './SchemaTypes';
import type { DisplayMode, Style, StyleItem, TagType } from './StyleTypes';

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

export type SegmentsContextValue = {
  segments: Record<string, Segment>;
  dispatchSegments?: unknown;
  segmentGet: (identifier: string) => Promise<Segment>;
  segmentsFetch: (filter?: string, cursor?: string, limit?: number) => Promise<Segment[]>;
  segmentsAdd: (segment: Segment) => void;
  segmentsUpdate: (segment: Segment) => void;
  segmentsRemove: (id: Segment['id']) => void;
  segmentAddElement: (
    id: Segment['id'],
    to: Element['id'],
    data: Element,
    dropPosition?: DropPosition,
    initialItems?: Record<string, Element>,
    variables?: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
  segmentUpdateElement: (id: Segment['id'], element: Element, fromSubscriptions?: boolean) => void;
  segmentMoveElement: (
    id: Segment['id'],
    from: Element['id'],
    to: Element['id'],
    elementId: Element['id'],
    dropPosition?: DropPosition,
    fromSubscriptions?: boolean
  ) => void;
  segmentRemoveElement: (id: Segment['id'], elementId: Element['id'], fromSubscriptions?: boolean) => void;
  segmentAddSelector: (
    id: Segment['id'],
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value: StyleItem['attributes'],
    fromSubscriptions?: boolean
  ) => void;
  segmentUpdateSelector: (
    id: Segment['id'],
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value: StyleItem['attributes'],
    fromSubscriptions?: boolean
  ) => void;
  segmentRemoveSelector: (id: Segment['id'], selector: string, fromSubscriptions?: boolean) => void;
  segmentAddVariable: (id: Segment['id'], variable: string, value: string, fromSubscriptions?: boolean) => void;
  segmentUpdateVariable: (id: Segment['id'], variable: string, value: string, fromSubscriptions?: boolean) => void;
  segmentRemoveVariable: (id: Segment['id'], variable: string, fromSubscriptions?: boolean) => void;
  segmentAddTemplate: (
    id: Segment['id'],
    to: Element['id'],
    data: Element,
    dropPosition: DropPosition,
    initialItems: Record<string, Element>,
    templatePlatform: Style['platform'],
    variables: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
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
    schema: Schema,
    style: Style,
    variables?: SchemaVariable[]
  ) => Promise<void>;
};

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
