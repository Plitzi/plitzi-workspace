import type { Element } from './SchemaTypes';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderContextValue = {
  mode: 'normal' | 'template' | 'segment';
  schemaName: string;
  setMultiPagesMode: Dispatch<SetStateAction<boolean>>;
  multiPagesMode: boolean;
  hasMultiPages: boolean;
  baseContext: { baseElementId: string };
  baseElementIdOriginal: string;
  builderSetBaseContext: (id: string) => void;
  builderElementPermissions: (element: Element, path?: string, defaultValue?: boolean) => Record<string, boolean>;
  builderHandler: (event: string, ...data: unknown[]) => void;
  updateElement: (
    elementId: string,
    attributeKey?: string,
    attributeValue?: unknown,
    category?: 'attributes' | 'definition'
  ) => void;
};
