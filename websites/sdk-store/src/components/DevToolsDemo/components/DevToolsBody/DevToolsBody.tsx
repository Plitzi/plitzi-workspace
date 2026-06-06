import { useCallback, useState } from 'react';

import { useDevToolsStore } from '../../devToolsStore';

import type { ChangeEvent } from 'react';

const hasReduxDevTools = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__);

const DevToolsBody = () => {
  const [count, setCount] = useDevToolsStore('count');
  const [name, setName] = useDevToolsStore('user.name');
  const [detected] = useState(hasReduxDevTools);

  const handleName = useCallback((event: ChangeEvent<HTMLInputElement>) => setName(event.target.value), [setName]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs tracking-wide text-zinc-500 uppercase">count</span>
        <button
          onClick={() => setCount(value => value - 1)}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-8 w-8 items-center justify-center rounded-lg border text-zinc-300 transition hover:text-white"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center font-mono text-lg font-bold text-white">{count}</span>
        <button
          onClick={() => setCount(value => value + 1)}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-8 w-8 items-center justify-center rounded-lg border text-zinc-300 transition hover:text-white"
        >
          +
        </button>
        <span className="text-xs text-zinc-600">
          dispatches action <code className="text-brand-300">count</code>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-16 text-xs tracking-wide text-zinc-500 uppercase">name</span>
        <input
          value={name}
          onChange={handleName}
          className="border-ink-600 bg-ink-800 focus:border-brand-500 min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-mono text-sm text-white outline-none"
        />
        <span className="shrink-0 text-xs text-zinc-600">
          action <code className="text-brand-300">user.name</code>
        </span>
      </div>

      {detected ? (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3">
          <p className="text-xs leading-relaxed text-emerald-300">
            ✓ Redux DevTools detected. Open it and select the{' '}
            <code className="text-emerald-200">sdk-store · website demo</code> instance — each edit above shows up as an
            action. Drag the slider to a past action and the values here <strong>time-travel</strong> with it, because
            the middleware writes the jumped state back through <code className="text-emerald-200">setState</code>.
          </p>
        </div>
      ) : (
        <div className="border-ink-700 bg-ink-950/60 rounded-lg border p-3">
          <p className="text-xs leading-relaxed text-zinc-500">
            Redux DevTools isn’t installed, so the middleware is a <strong className="text-zinc-300">no-op</strong> —
            edits still work, nothing else happens.{' '}
            <a
              href="https://github.com/reduxjs/redux-devtools"
              target="_blank"
              rel="noreferrer"
              className="text-brand-300 hover:text-brand-200 underline decoration-dotted underline-offset-2"
            >
              Install the extension
            </a>{' '}
            and reload to see actions and time-travel.
          </p>
        </div>
      )}

      <p className="border-ink-800 border-t pt-4 text-xs leading-relaxed text-zinc-600">
        One line — <code className="text-brand-300">reduxDevToolsMiddleware()</code> — rides the same{' '}
        <code className="text-brand-300">subscribeChange</code> substrate as logger/persist/history. It connects on
        creation, sends every committed change as an action, and reflects DevTools time-travel back into the store.
      </p>
    </div>
  );
};

export default DevToolsBody;
