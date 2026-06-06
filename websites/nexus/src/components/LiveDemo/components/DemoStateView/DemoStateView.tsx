import { useDemoStore } from '../../demoStore';

const DemoStateView = () => {
  const [state] = useDemoStore();

  return (
    <div className="flex min-w-0 grow basis-0 flex-col">
      <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">store.getState()</span>
      <pre className="border-ink-700 bg-ink-950 text-brand-200 mt-2 grow basis-0 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
};

export default DemoStateView;
