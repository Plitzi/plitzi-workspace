import { useCallback } from 'react';

import { useInterceptStore } from '../../interceptStore';

import type { ChangeEvent } from 'react';

const InterceptBody = () => {
  const [quantity, setQuantity] = useInterceptStore('quantity');
  const [code, setCode] = useInterceptStore('code');
  const [frozen, setFrozen] = useInterceptStore('frozen');

  const handleCode = useCallback((event: ChangeEvent<HTMLInputElement>) => setCode(event.target.value), [setCode]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-20 text-xs tracking-wide text-zinc-500 uppercase">quantity</span>
        <button
          onClick={() => setQuantity(value => value - 1)}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-8 w-8 items-center justify-center rounded-lg border text-zinc-300 transition hover:text-white"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center font-mono text-lg font-bold text-white">{quantity}</span>
        <button
          onClick={() => setQuantity(value => value + 1)}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-8 w-8 items-center justify-center rounded-lg border text-zinc-300 transition hover:text-white"
        >
          +
        </button>
        <span className="text-xs text-zinc-600">
          clamped to <code className="text-brand-300">0–10</code> by the middleware
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-20 text-xs tracking-wide text-zinc-500 uppercase">code</span>
        <input
          value={code}
          onChange={handleCode}
          placeholder="type ab-cd!"
          className="border-ink-600 bg-ink-800 focus:border-brand-500 min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-mono text-sm text-white outline-none"
        />
        <span className="shrink-0 text-xs text-zinc-600">
          → <code className="text-brand-300">UPPER</code>, alnum, ≤8
        </span>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <span className="w-20 text-xs tracking-wide text-zinc-500 uppercase">frozen</span>
        <input
          type="checkbox"
          checked={frozen}
          onChange={event => setFrozen(event.target.checked)}
          className="accent-brand-500 h-4 w-4"
        />
        <span className="text-xs text-zinc-600">
          {frozen ? (
            <span className="text-amber-400">🔒 read-only — the guard CANCELs every other write</span>
          ) : (
            'lock the store: writes above get blocked before they commit'
          )}
        </span>
      </label>

      <p className="border-ink-800 border-t pt-4 text-xs leading-relaxed text-zinc-600">
        Every edit flows through one <code className="text-brand-300">beforeChange</code> middleware that runs{' '}
        <em>before</em> the commit. It rewrites the value (clamp / normalize) or returns{' '}
        <code className="text-brand-300">CANCEL</code> to veto it — so the store never holds an out-of-range or frozen
        value, no validation scattered across components.
      </p>
    </div>
  );
};

export default InterceptBody;
