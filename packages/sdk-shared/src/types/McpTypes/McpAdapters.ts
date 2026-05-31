/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  AiContext,
  DisplayMode,
  Resource,
  StyleCategory,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from '../..';
import type { McpPlugin, McpSegment, McpStyleVariable } from '../McpTypes';
import type { DropPosition, Element, PageFolder, Schema, SchemaVariable } from '../SchemaTypes';
import type { Theme } from '../ThemeTypes';

export type McpAdapter<R = any, T extends Record<string, any> = Record<string, any>> = (
  args: T,
  ctx: AiContext
) => Promise<{ data: R } | { error: Error | string }>;

export type McpAdaptersSchema = {
  applyPreview: McpAdapter<
    { baseElementId: string; targetParentId: string; elementCount: number },
    {
      schema: { flat: Record<string, Element> };
      style?: Record<string, unknown>;
      baseElementId: string;
      targetParentId: string;
      dropPosition?: DropPosition;
    }
  >;
};

export type PageElementSummary = {
  id: string;
  label: string;
  type: string;
  parentId: string | null;
  attributes: Record<string, unknown>;
};

export type McpAdaptersPages = {
  getPage: McpAdapter<{ page: Element; elements: PageElementSummary[] } | undefined, { pageId: string }>;
  getPages: McpAdapter<Element[]>;
  getPageBySlug: McpAdapter<Element | undefined, { slug: string }>;
  createPage: McpAdapter<Element, { name: string }>;
  updatePage: McpAdapter<
    Element,
    { pageId: string; updates: { name?: string; slug?: string; default?: boolean; folder?: string } }
  >;
  deletePage: McpAdapter<boolean, { pageId: string }>;
};

export type McpAdaptersPageFolders = {
  getPageFolder: McpAdapter<PageFolder | undefined, { folderId: string }>;
  getPageFolders: McpAdapter<PageFolder[]>;
  createPageFolder: McpAdapter<PageFolder, { name: string; parentId?: string }>;
  updatePageFolder: McpAdapter<
    PageFolder,
    { id: string; updates: Partial<Pick<PageFolder, 'name' | 'slug' | 'parentId'>> }
  >;
  deletePageFolder: McpAdapter<boolean, { id: string }>;
};

export type McpAdaptersElements = {
  createElement: McpAdapter<Element | undefined, { element: Element; parentId?: string; position?: number }>;
  getElement: McpAdapter<Element | undefined, { elementId: string }>;
  getElements: McpAdapter<Element[], { pageId?: string; type?: string; parentId?: string }>;
  listElements: McpAdapter<
    { id: string; label: string; type: string; parentId?: string; items?: string[] }[],
    { rootId?: string; parentId?: string; type?: string }
  >;
  updateElement: McpAdapter<Element, Element>;
  deleteElement: McpAdapter<boolean, { elementId: string }>;
  moveElement: McpAdapter<boolean, { elementId: string; toParentId: string; dropPosition?: DropPosition }>;
  cloneElement: McpAdapter<
    { id: string; label: string; type: string; parentId?: string; items?: string[] }[],
    { elementId: string; to: string; dropPosition: DropPosition }
  >;
};

export type McpAdaptersSchemaVariables = {
  getVariable: McpAdapter<SchemaVariable | undefined, { name: string }>;
  getVariables: McpAdapter<SchemaVariable[]>;
  createSchemaVariable: McpAdapter<
    SchemaVariable,
    { variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> }
  >;
  updateSchemaVariable: McpAdapter<SchemaVariable, { variable: Partial<SchemaVariable> & { name: string } }>;
  deleteSchemaVariable: McpAdapter<boolean, { name: string }>;
};

export type McpAdaptersStyles = {
  getStyleVariables: McpAdapter<Record<string, Record<string, StyleVariableValue>>>;
  getStyleVariable: McpAdapter<StyleVariableValue | undefined, { category: StyleVariableCategory; name: string }>;
  getStyleSelectors: McpAdapter<Record<string, string[]>, { displayMode?: string }>;
  updateStyle: McpAdapter;
  updateStyleSettings: McpAdapter;
};

export type McpAdaptersStylesVariables = {
  createStyleVariable: McpAdapter<
    { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  updateStyleVariable: McpAdapter<
    McpStyleVariable,
    { category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  deleteStyleVariable: McpAdapter<boolean, { category: StyleVariableCategory; name: string }>;
};

export type McpAdaptersStylesSelectors = {
  createStyleSelector: McpAdapter<
    StyleItem,
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    }
  >;
  updateStyleSelector: McpAdapter<
    StyleItem,
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    }
  >;
  deleteStyleSelector: McpAdapter<boolean, { displayMode: DisplayMode; selector: string }>;
};

export type McpAdaptersSegments = {
  createSegment: McpAdapter<McpSegment, { name: string; description: string }>;
  updateSegment: McpAdapter<McpSegment, { segmentId: string; updates: { name?: string; description?: string } }>;
  deleteSegment: McpAdapter<boolean, { segmentId: string }>;
  getSegment: McpAdapter<Record<string, unknown> | undefined, { segmentId?: string; identifier?: string }>;
  getSegments: McpAdapter<Record<string, unknown>[], { cursor?: string; limit?: number }>;
  createSegmentElement: McpAdapter<
    Element,
    {
      segmentId: string;
      element: { type: string; label: string; props?: Record<string, unknown> };
      parentId: string;
    }
  >;
  updateSegmentElement: McpAdapter<
    Element,
    { segmentId: string; elementId: string; updates: { label?: string; props?: Record<string, unknown> } }
  >;
  moveSegmentElement: McpAdapter<
    boolean,
    { segmentId: string; elementId: string; toParentId: string; dropPosition?: DropPosition }
  >;
  deleteSegmentElement: McpAdapter<boolean, { segmentId: string; elementId: string }>;
  cloneSegmentElement: McpAdapter;
  createSegmentVariable: McpAdapter<
    SchemaVariable,
    { segmentId: string; variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> }
  >;
  updateSegmentVariable: McpAdapter<
    SchemaVariable,
    { segmentId: string; variable: Partial<SchemaVariable> & { name: string } }
  >;
  deleteSegmentVariable: McpAdapter<boolean, { segmentId: string; name: string }>;
  createSegmentStyleVariable: McpAdapter<
    McpStyleVariable,
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  updateSegmentStyleVariable: McpAdapter<
    McpStyleVariable,
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  deleteSegmentStyleVariable: McpAdapter<boolean, { segmentId: string; category: StyleVariableCategory; name: string }>;
  addSegmentStyleSelector: McpAdapter<
    StyleItem,
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params: Record<string, unknown>;
    }
  >;
  updateSegmentStyleSelector: McpAdapter<
    StyleItem,
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params: Record<string, unknown>;
    }
  >;
  deleteSegmentStyleSelector: McpAdapter<boolean, { segmentId: string; displayMode: DisplayMode; selector: string }>;
  addSegmentStyleSelectorVariable: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    },
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    }
  >;
  updateSegmentStyleSelectorVariable: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    },
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    }
  >;
  removeSegmentStyleSelectorVariable: McpAdapter<
    boolean,
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
    }
  >;
  addSegmentSelectorVariable: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    },
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    }
  >;
  updateSegmentSelectorVariable: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    },
    {
      segmentId: string;
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    }
  >;
  removeSegmentSelectorVariable: McpAdapter<
    boolean,
    { segmentId: string; displayMode: DisplayMode; selector: string; category: StyleVariableCategory; name: string }
  >;
};

export type McpAdaptersPlugins = {
  listPlugins: McpAdapter<McpPlugin[]>;
  addPlugin: McpAdapter<
    { type: string; resource: string; settings: Record<string, unknown> },
    { pluginType: string; resource: string; override?: boolean }
  >;
  updatePlugin: McpAdapter<
    { type: string; resource: string; settings: Record<string, unknown> },
    { pluginType: string; resource: string }
  >;
  removePlugin: McpAdapter<boolean, { pluginType: string }>;
};

export type McpAdaptersCollections = {
  getCollections: McpAdapter<Record<string, unknown>[], Record<string, unknown>>;
  getCollection: McpAdapter<Record<string, unknown> | undefined, { collectionId: string }>;
  createCollection: McpAdapter;
  updateCollection: McpAdapter;
  deleteCollection: McpAdapter<boolean, any>;
  getCollectionRecords: McpAdapter;
  getCollectionRecord: McpAdapter;
  createCollectionRecord: McpAdapter;
  updateCollectionRecord: McpAdapter;
  deleteCollectionRecord: McpAdapter<boolean, { collectionId: string; recordId: string }>;
};

export type McpAdaptersResources = {
  // addTemplate: McpAdapter;
  getResources: McpAdapter;
  getResource: McpAdapter<Resource | undefined, { identifier: string; cdnIdentifier: string }>;
  addResource: McpAdapter<
    Resource | undefined,
    { url: string; cdnIdentifier: string; filename?: string; type?: string; prefix?: string; compression?: string }
  >;
  moveResource: McpAdapter<Resource | undefined, { identifier: string; cdnIdentifier: string; prefix: string }>;
  removeResource: McpAdapter<{ id: string } | undefined, { identifier: string; cdnIdentifier: string }>;
};

export type McpAdaptersSpace = {
  getSpaceSettings: McpAdapter<Schema['settings'] | undefined>;
  updateSpaceSettings: McpAdapter<Schema['settings'], { path?: string; value?: string | number | boolean }>;
};

export type McpAdapters = {
  getBuilderContext: McpAdapter<
    | {
        currentPageId?: string;
        selectedElementId?: string;
        cssVariables: Record<string, { default: string; light?: string; dark?: string }> | undefined;
        elementDefaults: any;
        elements: { id: string; label: string; type: string; parentId?: string }[];
        theme?: Exclude<Theme, 'system'>;
      }
    | undefined
  >;
} & McpAdaptersSchema &
  McpAdaptersPages &
  McpAdaptersPageFolders &
  McpAdaptersElements &
  McpAdaptersSchemaVariables &
  McpAdaptersStyles &
  McpAdaptersStylesVariables &
  McpAdaptersStylesSelectors &
  McpAdaptersSegments &
  McpAdaptersPlugins &
  McpAdaptersCollections &
  McpAdaptersResources &
  McpAdaptersSpace;
