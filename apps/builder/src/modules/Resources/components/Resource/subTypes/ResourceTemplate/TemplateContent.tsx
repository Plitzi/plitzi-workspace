import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { Schema, Style } from '@plitzi/sdk-shared';

export type TemplateContentProps = {
  baseElementId: string;
  schema: Schema;
  style: Style;
};

const TemplateContent = ({ baseElementId, schema, style }: TemplateContentProps) => {
  const builderSchemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const builderStyleValueMemo = useMemo(() => ({ style }), [style]);

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div className="relative flex flex-col overflow-hidden">
        <SchemaContext value={builderSchemaValueMemo}>
          <StyleContext value={builderStyleValueMemo}>
            <ContainerAutoScale className="flex min-h-46 w-full items-center justify-center overflow-hidden rounded-sm">
              <BuilderAreaPreview
                id={baseElementId}
                schema={schema}
                styleCache={style.cache}
                className="h-full w-full"
                previewMode
              />
            </ContainerAutoScale>
          </StyleContext>
        </SchemaContext>
      </div>
    </div>
  );
};

export default TemplateContent;
