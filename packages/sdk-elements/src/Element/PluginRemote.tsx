import { lazy, Suspense, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import loadComponent from './helpers/loadComponent';

import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';

export type PluginRemoteProps = {
  url: string;
  scope: string;
  internalProps: InternalPropsSTG1;
  autoRegister?: boolean;
  plitziJsxSkipHOC?: boolean;
  plitziJsxProps?: Record<string, unknown>;
};

const PluginRemote = ({
  url = '',
  scope = '',
  internalProps,
  autoRegister = true,
  // Props from JSX
  plitziJsxSkipHOC = false,
  plitziJsxProps = emptyObject
}: PluginRemoteProps) => {
  const { register } = use(ComponentContext);
  const Component = useMemo(
    () => lazy(loadComponent(url, scope, register, autoRegister, plitziJsxSkipHOC)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, scope]
  );

  if (plitziJsxSkipHOC) {
    return (
      <Suspense>
        <Component internalProps={internalProps} plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps} />
      </Suspense>
    );
  }

  return (
    <Suspense>
      <Component internalProps={internalProps} />
    </Suspense>
  );
};

export default PluginRemote;
