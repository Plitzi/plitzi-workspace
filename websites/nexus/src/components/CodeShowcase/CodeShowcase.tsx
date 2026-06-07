import { useMemo, useState } from 'react';

import type { CodeSample } from '../../content';
import { CODE_SAMPLES } from '../../content';
import CodeBlock from '../CodeBlock';
import SectionHeading from '../SectionHeading';
import CodeShowcaseTab from './components/CodeShowcaseTab';

const GROUPS: { key: CodeSample['category']; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'advanced', label: 'Advanced Cases' }
];

const CodeShowcase = () => {
  const [activeGroup, setActiveGroup] = useState<CodeSample['category']>('basic');

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map(({ key }) => [key, CODE_SAMPLES.filter(s => s.category === key)])
      ) as Record<CodeSample['category'], CodeSample[]>,
    []
  );

  const activeSamples = grouped[activeGroup];
  const [activeId, setActiveId] = useState(activeSamples[0].id);

  const activeSample = useMemo(
    () => activeSamples.find(sample => sample.id === activeId) ?? activeSamples[0],
    [activeId, activeSamples]
  );

  const handleGroupChange = (group: CodeSample['category']) => {
    setActiveGroup(group);
    setActiveId(grouped[group][0].id);
  };

  return (
    <section id="api" className="border-y border-ink-800 bg-ink-900/30">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="The API"
          title="Four hooks. Infinite precision."
          subtitle="A handful of composable primitives cover reads, writes, syncing, and non-reactive access — all typed against your state shape."
        />

        <div className="mx-auto mt-12 max-w-3xl">
          {/* Category tabs */}
          <div className="mb-4 flex gap-2">
            {GROUPS.map(group => (
              <button
                key={group.key}
                onClick={() => handleGroupChange(group.key)}
                className={
                  activeGroup === group.key
                    ? 'flex-1 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white'
                    : 'flex-1 rounded-lg bg-ink-800 px-4 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-ink-700 hover:text-white'
                }
              >
                {group.label}
              </button>
            ))}
          </div>

          {/* Feature tabs */}
          <div className="flex flex-wrap gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-1.5">
            {activeSamples.map(sample => (
              <CodeShowcaseTab
                key={sample.id}
                id={sample.id}
                label={sample.label}
                isActive={sample.id === activeId}
                onSelect={setActiveId}
              />
            ))}
          </div>

          <div className="mt-6">
            <CodeBlock code={activeSample.code} demoId={activeSample.demoId ?? activeSample.id} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CodeShowcase;
