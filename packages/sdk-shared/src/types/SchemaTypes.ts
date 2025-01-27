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

export type Element = {
  id: string;
  definition: Omit<
    { [key: string]: unknown },
    'parentId' | 'items' | 'styleSelectors' | 'string' | 'bindings' | 'label' | 'rootId'
  > & {
    rootId: string;
    label: string;
    type: string;
    parentId?: string;
    items?: string[];
    styleSelectors: { [key: string]: string };
    bindings?: { [key: string]: ElementBinding | undefined };
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

export type Schema = {
  flat: { [key: string]: Element | undefined };
  variables: SchemaVariable[];
  settings: { customCss: string };
  pages: string[];
  pageFolders: { id: string; name: string; slug: string; parentId: string }[];
};
