import { useMemo } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { StoreProvider } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { Schema, Style } from '@plitzi/sdk-shared';

export type TransformPreviewProps = {
  preview: { schema: Schema; style: Style; definition: { rootId: string } };
  previewMode?: boolean;
};

const TransformPreview = ({ preview, previewMode = true }: TransformPreviewProps) => {
  const storeValue = useMemo(() => ({ schema: preview.schema, style: preview.style }), [preview.schema, preview.style]);

  return (
    <div className="flex w-full grow overflow-y-auto">
      <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('transform-preview')}>
        <BuilderAreaPreview
          previewMode={previewMode}
          className="min-h-full w-full"
          schema={storeValue.schema}
          id={preview.definition.rootId}
          styleCache={storeValue.style.cache}
        />
      </StoreProvider>
    </div>
  );
};

export default TransformPreview;
