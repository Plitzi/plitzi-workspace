import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import { loggerMiddleware as loggerMw } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState, Snippet } from '@plitzi/sdk-shared';

export type SnippetContentProps = {
  baseElementId: string;
  schema: Snippet['schema'];
  style: Snippet['style'];
};

const SnippetContent = ({ baseElementId, schema, style }: SnippetContentProps) => {
  const [[mainSchema, pageDefinitions]] = useBuilderStore(['schema', 'pageDefinitions']);

  const storeValue = useMemo(
    () => ({ schema: { ...mainSchema, ...schema }, style, pageDefinitions }),
    [mainSchema, pageDefinitions, schema, style]
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div className="relative flex flex-col overflow-hidden">
        <StoreProvider value={storeValue} middlewares={[loggerMw(createStoreDevToolsLogger<BuilderState>('snippet'))]}>
          <ContainerAutoScale className="flex min-h-46 w-full items-center justify-center overflow-hidden">
            <BuilderAreaPreview id={baseElementId} className="h-full w-full" previewMode />
          </ContainerAutoScale>
        </StoreProvider>
      </div>
    </div>
  );
};

export default SnippetContent;
