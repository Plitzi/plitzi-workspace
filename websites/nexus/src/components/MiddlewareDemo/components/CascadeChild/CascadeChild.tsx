import { useChildStore } from '../../middlewareStore';

// Nested store with NO middlewares of its own. It still logs because the parent marked its logger with `cascade()`,
// so every child provider inherits it. persist/history are deliberately NOT cascaded (per-store), so this child's
// writes are logged but not saved or recorded for undo.
const CascadeChild = () => {
  const [ping, setPing] = useChildStore('ping');

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-ink-700 bg-ink-900/40 px-4 py-3">
      <button
        onClick={() => setPing(value => value + 1)}
        className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white"
      >
        child write · ping = {ping}
      </button>
      <p className="text-xs leading-relaxed text-zinc-600">
        Separate nested store, no middlewares — yet it appears in the feed, because the logger was{' '}
        <code className="text-brand-300">cascade()</code>’d and is inherited.
      </p>
    </div>
  );
};

export default CascadeChild;
