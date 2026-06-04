import { useMemo, useState } from 'react';

import { CODE_SAMPLES } from '../../content';
import CodeBlock from '../CodeBlock';
import SectionHeading from '../SectionHeading';
import CodeShowcaseTab from './components/CodeShowcaseTab';

const CodeShowcase = () => {
  const [activeId, setActiveId] = useState(CODE_SAMPLES[0].id);

  const activeSample = useMemo(
    () => CODE_SAMPLES.find(sample => sample.id === activeId) ?? CODE_SAMPLES[0],
    [activeId]
  );

  return (
    <section id="api" className="border-y border-ink-800 bg-ink-900/30">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading
          eyebrow="The API"
          title="Four hooks. Infinite precision."
          subtitle="A handful of composable primitives cover reads, writes, syncing, and non-reactive access — all typed against your state shape."
        />

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="mb-4 flex flex-wrap justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-1.5">
            {CODE_SAMPLES.map(sample => (
              <CodeShowcaseTab
                key={sample.id}
                id={sample.id}
                label={sample.label}
                isActive={sample.id === activeId}
                onSelect={setActiveId}
              />
            ))}
          </div>

          <CodeBlock code={activeSample.code} />
        </div>
      </div>
    </section>
  );
};

export default CodeShowcase;
