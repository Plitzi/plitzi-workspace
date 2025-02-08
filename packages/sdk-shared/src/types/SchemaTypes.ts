// Types
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type ElementBinding = {
  id: string;
  source: string;
  fromPath: string;
  transformers: {
    type: string;
    action: string;
    params: {
      valueType: string;
      value: string;
    };
  }[];
  when: RuleGroup;
  toPath: string;
};

export type ElementInteraction = {
  id: string;
  title: string;
  type: 'trigger' | 'globalCallback' | 'callback' | 'utility';
  action: string;
  params: Record<string, unknown>;
  preview: Record<string, unknown>;
  elementId: string;
  beforeNode: string;
  afterNode: string;
  flowId: string;
  enabled: boolean;
  when?: RuleGroup;
};

export type Element = {
  id: string;
  definition: Omit<
    { [key: string]: unknown },
    'parentId' | 'items' | 'styleSelectors' | 'string' | 'bindings' | 'label' | 'rootId' | 'interactions'
  > & {
    rootId: string;
    label: string;
    type: string;
    parentId?: string;
    items?: string[];
    styleSelectors: { [key: string]: string };
    bindings?: Record<string, ElementBinding>;
    interactions?: Record<string, ElementInteraction>;
  };
  attributes: Omit<{ [key: string]: unknown }, 'subType'> & {
    subType?: string;
  };
};

export type SchemaVariable = {
  name: string;
  category: string;
  type: string;
  value: string;
  subValues: {
    when: RuleGroup;
    value: string;
  }[];
};

export type PageFolder = { id: string; name: string; slug: string; parentId: string };

export type Schema = {
  flat: { [key: string]: Element | undefined };
  variables: SchemaVariable[];
  settings: {
    customCss: string;
    userProvider?: 'auth0' | 'basic' | 'custom' | '';
    auth0Domain?: string;
    auth0ClientId?: string;
    loginUrl?: string;
    refreshUrl?: string;
    detailsPath?: string;
    tokenPath?: string;
    expirationTimePath?: string;
  };
  pages: string[];
  pageFolders: PageFolder[];
};
