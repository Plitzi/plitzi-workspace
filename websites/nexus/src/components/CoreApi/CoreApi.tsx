import { type CSSProperties } from 'react';

import { type CoreVerb, CORE_VERBS } from './coreApiContent';
import SectionHeading from '../SectionHeading';
import useReveal from '../../useReveal';

const VerbCard = ({ verb, index }: { verb: CoreVerb; index: number }) => {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ '--reveal-delay': `${index * 90}ms` } as CSSProperties}
      className={`reveal card border-ink-700 bg-ink-900/60 flex flex-col rounded-2xl border p-6 ${visible ? 'is-visible' : ''}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-gradient font-mono text-2xl font-bold">{verb.verb}</span>
        <span className="text-[11px] tracking-wide text-zinc-500 uppercase">{verb.tagline}</span>
      </div>

      <code className="text-brand-300 mt-2 font-mono text-sm">{verb.signature}</code>

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{verb.description}</p>

      <pre className="border-ink-700 bg-ink-950/70 mt-5 overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed text-zinc-200">
        {verb.code}
      </pre>
    </div>
  );
};

const CoreApi = () => (
  <section id="core-api" className="relative px-5 py-24">
    <div className="bg-grid absolute inset-0 -z-10 opacity-40 mask-[radial-gradient(ellipse_at_center,black,transparent_75%)]" />
    <div className="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Three verbs"
        title={
          <>
            Learn <span className="text-gradient">get · set · watch</span>, know the store
          </>
        }
        subtitle="The entire imperative API fits in three words. Everything else — entities, async, history, middleware — is an opt-in add-on you reach for only when you need it."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {CORE_VERBS.map((verb, i) => (
          <VerbCard key={verb.verb} verb={verb} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default CoreApi;
