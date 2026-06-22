import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import { loggerMiddleware as loggerMw } from '@plitzi/nexus';
import { createStoreHook } from '@plitzi/nexus/react';
import { StoreProvider } from '@plitzi/nexus/react';
import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState, Schema, Style } from '@plitzi/sdk-shared';

export type TemplateContentProps = {
  baseElementId: string;
  schema: Schema;
  style: Style;
};

const TemplateContent = ({ baseElementId, schema, style }: TemplateContentProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[mainSchema, pageDefinitions]] = useStore(['schema', 'pageDefinitions']);

  const storeValue = useMemo(
    () => ({ schema: { ...mainSchema, ...schema }, style, pageDefinitions }),
    [mainSchema, pageDefinitions, schema, style]
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div className="relative flex flex-col overflow-hidden">
        <StoreProvider<BuilderState>
          value={storeValue}
          middlewares={[loggerMw(createStoreDevToolsLogger<BuilderState>('template'))]}
        >
          <ContainerAutoScale className="flex min-h-46 w-full items-center justify-center overflow-hidden">
            <BuilderAreaPreview id={baseElementId} className="h-full w-full" previewMode />
          </ContainerAutoScale>
        </StoreProvider>
      </div>
    </div>
  );
};

export default TemplateContent;
