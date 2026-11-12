import { lazy, Suspense, use, useEffect, useMemo, useState } from 'react';

import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { emptyObject } from '@plitzi/sdk-shared/helpers';

import loadComponent from './helpers/loadComponent';

import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';

export type PluginRemoteProps = {
  url: string;
  /** The element's type, when it is not the plugin's main one: a plugin's other elements load from the same URL. */
  type?: string;
  internalProps: InternalPropsSTG1;
  autoRegister?: boolean;
  plitziJsxSkipHOC?: boolean;
  plitziJsxProps?: Record<string, unknown>;
};

const PluginRemote = ({
  url = '',
  type,
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
    () => lazy(loadComponent(url, register, autoRegister, plitziJsxSkipHOC, type)),
    // Made again only when what it loads changes: every new `lazy` is a new component, and remounts the plugin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, type]
  );

  if (!mounted) {
    return null;
  }

  // A JSX plugin that skips the element's wrapper takes its own props as well; any other, the element's alone.
  const jsxProps = plitziJsxSkipHOC ? { plitziJsxSkipHOC, ...plitziJsxProps } : emptyObject;

  return (
    <Suspense>
      {/* eslint-disable-next-line react-hooks/static-components -- the plugin's component, loaded from its address: made
          once per address above, never during a render that could make another */}
      <Component internalProps={internalProps} {...jsxProps} />
    </Suspense>
  );
};

export default PluginRemote;
