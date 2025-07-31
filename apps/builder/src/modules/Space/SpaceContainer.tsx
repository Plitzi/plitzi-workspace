import { ToastProvider } from '@plitzi/plitzi-ui/Toast';

import SpaceContainerInternal from './SpaceContainerInternal';

import type { ReactNode } from 'react';

export type SpaceContainerProps = {
  children?: ReactNode;
};

const SpaceContainer = ({ children }: SpaceContainerProps) => {
  return (
    <ToastProvider>
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

export default SpaceContainer;
