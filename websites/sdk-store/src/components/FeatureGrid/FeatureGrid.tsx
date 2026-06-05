import { FEATURES } from '../../content';
import SectionHeading from '../SectionHeading';

const FeatureGrid = () => (
  <section id="features" className="mx-auto max-w-6xl px-5 py-20">
    <SectionHeading
      eyebrow="Why sdk-store"
      title="State that gets out of your way"
      subtitle="Everything you need to model app state precisely — and nothing you don't. No reducers, no action types, no selector ceremony."
    />

    <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(feature => (
        <div
          key={feature.title}
          className="card group rounded-2xl border border-ink-700 bg-ink-900/50 p-6 hover:bg-ink-850"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-linear-to-br from-ink-800 to-ink-700 text-xl transition group-hover:border-brand-500/60 group-hover:from-brand-900/40">
            {feature.icon}
          </div>
          <h3 className="mt-5 text-base font-semibold text-white">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
        </div>
      ))}
    </div>
  </section>
);

export default FeatureGrid;
