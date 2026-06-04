import { ECOSYSTEM } from '../../content';
import SectionHeading from '../SectionHeading';

const Ecosystem = () => (
  <section id="ecosystem" className="border-t border-ink-800 bg-ink-900/30">
    <div className="mx-auto max-w-6xl px-5 py-24">
      <SectionHeading
        eyebrow="Part of a bigger picture"
        title="The state core of the Plitzi SDK"
        subtitle="sdk-store stands alone, but it's also the foundation a growing toolkit builds on — devtools, shared contracts, and more."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {ECOSYSTEM.map(pkg => (
          <a
            key={pkg.name}
            href={pkg.href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl border border-ink-700 bg-ink-900/50 p-6 transition hover:border-brand-600/60 hover:bg-ink-850"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-400">{pkg.tagline}</span>
            <h3 className="mt-2 font-mono text-sm font-semibold text-white">{pkg.name}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{pkg.description}</p>
            <span className="mt-4 text-sm font-medium text-zinc-500 transition group-hover:text-brand-300">
              View source →
            </span>
          </a>
        ))}
      </div>
    </div>
  </section>
);

export default Ecosystem;
