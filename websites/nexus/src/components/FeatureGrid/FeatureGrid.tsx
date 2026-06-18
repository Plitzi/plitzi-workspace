import { FEATURES } from '../../content';
import SectionHeading from '../SectionHeading';

import type { Feature } from '../../content';

// Group the features by task, preserving the order each group first appears in FEATURES.
const GROUPS: { group: string; features: Feature[] }[] = FEATURES.reduce<{ group: string; features: Feature[] }[]>(
  (groups, feature) => {
    const existing = groups.find(g => g.group === feature.group);
    if (existing) {
      existing.features.push(feature);
    } else {
      groups.push({ group: feature.group, features: [feature] });
    }

    return groups;
  },
  []
);

const FeatureGrid = () => (
  <section id="features" className="mx-auto max-w-6xl px-5 py-20">
    <SectionHeading
      eyebrow="Why @plitzi/nexus"
      title="State that gets out of your way"
      subtitle="Everything you need to model app state precisely — and nothing you don't. No reducers, no action types, no selector ceremony."
    />

    <div className="mt-14 space-y-12">
      {GROUPS.map(({ group, features }) => (
        <div key={group}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">{group}</h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(feature => (
              <div
                key={feature.title}
                className="card group rounded-2xl border border-ink-700 bg-ink-900/50 p-6 hover:bg-ink-850"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-linear-to-br from-ink-800 to-ink-700 text-xl transition group-hover:border-brand-500/60 group-hover:from-brand-900/40">
                  {feature.icon}
                </div>
                <h4 className="mt-5 text-base font-semibold text-white">{feature.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default FeatureGrid;
