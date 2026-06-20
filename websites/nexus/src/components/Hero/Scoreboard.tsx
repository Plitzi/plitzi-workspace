import { useDebug, useRenderCount } from './heroDebug';
import { type GameStats, useHeroStore } from './heroStore';
import { type StatConfig } from './heroGames';

const StatCell = ({ label, statKey }: { label: string; statKey: keyof GameStats }) => {
  const [value] = useHeroStore(`game.${statKey}`);
  const debug = useDebug();
  const renders = useRenderCount();

  return (
    <div className="flex flex-col items-start">
      <span className="text-[9px] tracking-[0.18em] text-zinc-500 uppercase">{label}</span>
      <span key={value} className="stat-pop text-brand-200 font-mono text-lg font-bold tabular-nums">
        {value}
      </span>
      {debug && <span className="font-mono text-[9px] text-emerald-400">{renders} renders</span>}
    </div>
  );
};

const Scoreboard = ({ stats }: { stats: StatConfig[] }) => (
  <div className="border-ink-700/70 bg-ink-900/60 pointer-events-auto flex items-center gap-7 rounded-full border px-6 py-2.5 backdrop-blur-md">
    {stats.map(stat => (
      <StatCell key={stat.key} label={stat.label} statKey={stat.key} />
    ))}
  </div>
);

export default Scoreboard;
