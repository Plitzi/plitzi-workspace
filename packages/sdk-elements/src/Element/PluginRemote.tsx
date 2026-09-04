/* eslint-disable react-hooks/static-components */

import { lazy, Suspense, use, useEffect, useMemo, useState } from 'react';

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
  /**
   * Nothing here until the browser has it.
   *
   * A remote plugin is fetched over HTTP and imported as a blob URL — neither exists on a server, so there was never
   * anything for this to render there. What it did instead was worse than rendering nothing: `renderToString` cannot
   * wait on a Suspense boundary, so it abandoned the WHOLE document and the page fell back to client rendering. One
   * plugin on one panel cost the rest of the page its SSR.
   *
   * The flag flips in an effect rather than on `typeof window`, so the first client render still matches the server's
   * and hydration has nothing to reconcile.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const Component = useMemo(
    () => lazy(loadComponent(url, scope, register, autoRegister, plitziJsxSkipHOC)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, scope]
  );

  if (!mounted) {
    return null;
  }

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
