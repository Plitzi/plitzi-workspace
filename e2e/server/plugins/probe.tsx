import { RootElement } from '@plitzi/plitzi-sdk';

/** What the three RSC element types render in the suite's own server: a stable label and the server slice,
 *  verbatim. The examples ship readable versions of these for a person to learn from — these exist so no test
 *  depends on an example's presentation choices. */
export const Probe = ({ runtime, data }: { runtime: string; data: unknown }) => (
  <RootElement>
    <div data-probe={runtime}>
      <strong>{`rsc:${runtime}`}</strong>
      <pre>{JSON.stringify(data ?? null)}</pre>
    </div>
  </RootElement>
);
