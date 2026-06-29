import { useMemo } from 'react';

import { loggerMiddleware as loggerMw } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState, Schema, Style } from '@plitzi/sdk-shared';

export type TransformPreviewProps = {
  preview: { schema: Schema; style: Style; definition: { rootId: string } };
  previewMode?: boolean;
};

const TransformPreview = ({ preview, previewMode = true }: TransformPreviewProps) => {
  const storeValue = useMemo(() => ({ schema: preview.schema, style: preview.style }), [preview.schema, preview.style]);

  return (
    <div className="flex w-full grow overflow-y-auto">
      <StoreProvider
        value={storeValue}
        middlewares={[loggerMw(createStoreDevToolsLogger<BuilderState>('transform-preview'))]}
      >
        <BuilderAreaPreview id={preview.definition.rootId} previewMode={previewMode} className="min-h-full w-full" />
      </StoreProvider>
    </div>
  );
};

export default TransformPreview;
