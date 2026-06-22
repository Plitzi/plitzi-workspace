import type { Framework } from '../../../../content';

const STATUS_STYLES: Record<Framework['status'], string> = {
  Core: 'bg-brand-500/15 text-brand-300',
  Stable: 'bg-emerald-500/15 text-emerald-300',
  'Via core': 'bg-ink-700/60 text-zinc-400'
};

type FrameworkCardProps = {
  framework: Framework;
};

const FrameworkCard = ({ framework }: FrameworkCardProps) => (
  <a
    href={framework.doc}
    className="group flex flex-col rounded-2xl border border-ink-700 bg-ink-900/50 p-6 transition hover:border-brand-600/60 hover:bg-ink-850"
  >
    <div className="flex items-center justify-between">
      <span className="text-2xl" aria-hidden="true">
        {framework.icon}
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[framework.status]}`}>
        {framework.status}
      </span>
    </div>

    <h3 className="mt-4 text-base font-semibold text-white">{framework.name}</h3>
    <code className="mt-2 block font-mono text-xs text-brand-300">{framework.entry}</code>
    <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{framework.blurb}</p>

    <span className="mt-4 text-sm font-medium text-zinc-500 transition group-hover:text-brand-300">
      Getting started →
    </span>
  </a>
);

export default FrameworkCard;
