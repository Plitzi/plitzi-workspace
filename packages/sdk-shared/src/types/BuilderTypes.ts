import type { Schema } from './SchemaTypes';
import type { Style } from './StyleTypes';

export type Template = {
  id?: string;
  definition: {
    name: string;
    description: string;
    baseElementId: Element['id'];
  };
  schema: Schema;
  style: Style;
};
