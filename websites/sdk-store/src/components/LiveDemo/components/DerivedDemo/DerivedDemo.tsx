import { useDemoStore } from '../../demoStore';

const DerivedDemo = () => {
  const [upper] = useDemoStore('user.name', { transformer: value => value.toUpperCase() });
  const [combined] = useDemoStore(['user.name', 'count'], {
    transformer: ([name, count]) => `${name} · ${count}`
  });

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        Edit <code className="font-mono text-brand-300">user.name</code> or{' '}
        <code className="font-mono text-brand-300">count</code> in Controls — these derived values recompute
        (memoized) with no extra re-renders.
      </p>

      <dl className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">name.toUpperCase()</dt>
          <dd className="text-brand-300">{upper}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">[name, count] →</dt>
          <dd className="text-brand-300">{combined}</dd>
        </div>
      </dl>
    </div>
  );
};

export default DerivedDemo;
