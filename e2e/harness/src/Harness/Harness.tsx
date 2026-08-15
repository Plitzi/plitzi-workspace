import { offlineData as sharedSpace } from '@plitzi/example-space/browser';
import PlitziSdk from '@plitzi/plitzi-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HarnessState } from './types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** A page whose only job is to render whatever schema a test hands it.
 *
 *  The examples each prove one way of wiring Plitzi up, which makes them the wrong place to ask "what does THIS
 *  schema look like": changing one to answer that would break what it demonstrates. The harness has no wiring to
 *  protect — it renders the shared space by default and any other space on request, which is what makes a
 *  visual regression reproducible without a backend, an account or a fixture file. */
const Harness = () => {
  const [state, setState] = useState<HarnessState>({ nonce: 0, offlineData: sharedSpace });
  const settleRef = useRef<(() => void) | null>(null);

  const renderSpace = useCallback(
    (offlineData: OfflineDataRaw) =>
      new Promise<void>(resolve => {
        settleRef.current = resolve;
        setState(current => ({ nonce: current.nonce + 1, offlineData }));
      }),
    []
  );

  const reset = useCallback(() => renderSpace(sharedSpace), [renderSpace]);

  useEffect(() => {
    window.plitziHarness = { render: renderSpace, reset };

    return () => {
      delete window.plitziHarness;
    };
  }, [renderSpace, reset]);

  useEffect(() => {
    settleRef.current?.();
    settleRef.current = null;
  }, [state.nonce]);

  return (
    <div id="plitzi-harness" data-nonce={state.nonce}>
      <PlitziSdk key={state.nonce} offlineMode offlineData={state.offlineData} environment="main" renderMode="raw" />
    </div>
  );
};

export default Harness;
