import SectionHeading from '../SectionHeading';
import { USE_CASES } from '../../content';

// "I want to… → reach for X" decision band. Each card deep-links into the "Choosing the right API" docs page so the
// reader lands on the right primitive instead of the first one they stumble on.
const UseCases = () => (
  <section id="use-cases" className="mx-auto max-w-6xl px-5 py-20">
    <SectionHeading
      eyebrow="By use case"
      title="Which tool for the job?"
      subtitle="nexus has one primitive for each job — and picking the wrong one quietly costs you the benefit. Start from what you're trying to do."
    />

    <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {USE_CASES.map(useCase => (
        <a
          key={useCase.job}
          href={`#/docs/choosing?anchor=${useCase.anchor}`}
          className="card group flex flex-col rounded-2xl border border-ink-700 bg-ink-900/50 p-6 transition hover:border-brand-500/60 hover:bg-ink-850"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">I want to</span>
          <h3 className="mt-1.5 text-base font-semibold text-white">{useCase.job}</h3>
          <code className="mt-3 inline-block w-fit rounded-md bg-ink-800 px-2 py-1 font-mono text-[13px] text-brand-200">
            {useCase.tool}
          </code>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{useCase.blurb}</p>
          <span className="mt-4 text-sm font-medium text-brand-400 transition group-hover:text-brand-300">
            Decision guide →
          </span>
        </a>
      ))}
    </div>
  </section>
);

export default UseCases;
