import { use, useEffect, useMemo, useRef } from 'react';

import { createDerived, StoreContext, useDerived } from '@plitzi/nexus';

import type { DemoState } from '../../demoStore';
import type { StoreApi } from '@plitzi/nexus';

const ComputedDemo = () => {
  const store = use(StoreContext) as StoreApi<DemoState>;
  const computes = useRef(0);

  const doubled = useMemo(
    () =>
      createDerived(store, ['count'], ([count]) => {
        computes.current += 1;

        return count * 2;
      }),
    [store]
  );

  useEffect(() => () => doubled.destroy(), [doubled]);

  const value = useDerived(doubled);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        <code className="font-mono text-brand-300">createDerived</code> computes from{' '}
        <code className="font-mono text-brand-300">count</code> once and is shared. Change{' '}
        <code className="font-mono text-brand-300">name</code> or <code className="font-mono text-brand-300">theme</code>{' '}
        in Controls — it does <strong className="text-zinc-300">not</strong> recompute.
      </p>

      <dl className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">count × 2</dt>
          <dd className="text-brand-300">{value}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">times recomputed</dt>
          <dd className="text-white">{computes.current}×</dd>
        </div>
      </dl>
    </div>
  );
};

export default ComputedDemo;
