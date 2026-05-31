import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { createStoreHook } from '@plitzi/sdk-store/createStore';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState, Schema, Style } from '@plitzi/sdk-shared';

export type SdkElementPreviewProps = {
  elementId: string;
  // When provided (e.g. preview_element with proposed overrides) the element is rendered from this
  // overlay schema/style instead of the live store, so non-persisted changes are reflected.
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
};

const SdkElementPreview = ({ elementId, schema, style }: SdkElementPreviewProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [liveElement] = useStore(`schema.flat.${elementId}`);
  const overlayValue = useMemo(() => ({ schema, style }), [schema, style]);
  const hasOverlay = !!schema;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!hasOverlay && !liveElement) {
    return (
      <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 font-mono text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
          preview · {elementId}
        </div>

        <div className="flex h-20 items-center justify-center font-mono text-xs text-zinc-400 dark:text-zinc-600">
          element not found · {elementId}
        </div>
      </div>
    );
  }

  let preview = <BuilderAreaPreview id={elementId} className="h-full w-full" previewMode />;
  if (hasOverlay) {
    preview = (
      <StoreProvider value={overlayValue} logger={createStoreDevToolsLogger('ai-preview')}>
        {preview}
      </StoreProvider>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 font-mono text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        preview · {elementId}
      </div>
      <ContainerAutoScale className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">
        {preview}
      </ContainerAutoScale>
    </div>
  );
};

export default SdkElementPreview;
