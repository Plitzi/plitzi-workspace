import { useCallback, useMemo, useRef, useState } from 'react';

import { cascade, historyMiddleware, loggerMiddleware, persistMiddleware } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import CascadeChild from './components/CascadeChild';
import MiddlewareBody from './components/MiddlewareBody';
import { MIDDLEWARE_CODE } from './middlewareCode';
import { CHILD_INITIAL, MIDDLEWARE_INITIAL, PERSIST_KEY } from './middlewareStore';

import type { LogEntry, MiddlewareState } from './middlewareStore';
import type { StoreChange } from '@plitzi/nexus';

const readPath = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]), obj);

const MiddlewareDemo = () => {
  const [log, setLog] = useState<LogEntry[]>([]);
  const idRef = useRef(0);

  const sink = useCallback((change: StoreChange<MiddlewareState>) => {
    const path = change.path ?? '(root)';
    const value = change.path ? String(readPath(change.next, change.path)) : '…';
    setLog(prev => [{ id: idRef.current++, path, value }, ...prev].slice(0, 6));
  }, []);

  // persist first so it hydrates before the others observe. The logger is cascade()'d, so nested providers inherit it.
  const middlewares = useMemo(
    () => [
      persistMiddleware<MiddlewareState>({ key: PERSIST_KEY }),
      cascade(loggerMiddleware<MiddlewareState>(sink)),
      historyMiddleware<MiddlewareState>()
    ],
    [sink]
  );

  return (
    <ExampleCard
      title="Middleware pipeline"
      subtitle="logger · persist · history · cascade — all on one subscribeChange substrate"
      code={MIDDLEWARE_CODE}
    >
      <StoreProvider value={MIDDLEWARE_INITIAL} autoSync={false} middlewares={middlewares}>
        <MiddlewareBody log={log} />
        <StoreProvider value={CHILD_INITIAL} autoSync={false}>
          <CascadeChild />
        </StoreProvider>
      </StoreProvider>
    </ExampleCard>
  );
};

export default MiddlewareDemo;
