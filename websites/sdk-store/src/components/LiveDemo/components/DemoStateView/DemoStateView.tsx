import { useDemoStore } from '../../demoStore';

const DemoStateView = () => {
  const [state] = useDemoStore();

  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">store.getState()</span>
      <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-relaxed text-brand-200">
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
};

export default DemoStateView;
