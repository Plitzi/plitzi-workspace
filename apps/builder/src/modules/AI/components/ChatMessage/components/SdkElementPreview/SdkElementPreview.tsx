import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';

import { createStoreHook } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState } from '@plitzi/sdk-shared';

export type SdkElementPreviewProps = { elementId: string };

const SdkElementPreview = ({ elementId }: SdkElementPreviewProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [element] = useStore(`schema.flat.${elementId}`);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!element) {
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

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 font-mono text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        preview · {elementId}
      </div>
      <ContainerAutoScale className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">
        <BuilderAreaPreview id={elementId} className="h-full w-full" previewMode />
      </ContainerAutoScale>
    </div>
  );
};

export default SdkElementPreview;
