import { useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { Schema, Style } from '@plitzi/sdk-shared';

export type TransformPreviewProps = {
  preview: { schema: Schema; style: Style; definition: { rootId: string } };
  previewMode?: boolean;
};

const TransformPreview = ({ preview, previewMode = true }: TransformPreviewProps) => {
  const schemaMemo = useMemo(() => ({ schema: preview.schema }), [preview.schema]);
  const styleMemo = useMemo(() => ({ style: preview.style }), [preview.style]);

  return (
    <div className="flex w-full grow overflow-y-auto">
      <SchemaContext value={schemaMemo}>
        <StyleContext value={styleMemo}>
          <BuilderAreaPreview
            previewMode={previewMode}
            className="min-h-full w-full"
            schema={schemaMemo.schema}
            id={preview.definition.rootId}
            styleCache={styleMemo.style.cache}
          />
        </StyleContext>
      </SchemaContext>
    </div>
  );
};

export default TransformPreview;
