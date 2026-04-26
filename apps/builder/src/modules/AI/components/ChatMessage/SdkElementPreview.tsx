import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';

import { createStoreHook } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { BuilderState } from '@plitzi/sdk-shared';

type SdkElementPreviewProps = { elementId: string };

const SdkElementPreview = ({ elementId }: SdkElementPreviewProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [element] = useStore(`schema.flat.${elementId}`);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!element) {
    return (
      <div className="flex h-20 items-center justify-center font-mono text-xs text-zinc-400 dark:text-zinc-600">
        element not found · {elementId}
      </div>
    );
  }

  return (
    <ContainerAutoScale className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">
      <BuilderAreaPreview id={elementId} className="h-full w-full" previewMode />
    </ContainerAutoScale>
  );
};

export default SdkElementPreview;
