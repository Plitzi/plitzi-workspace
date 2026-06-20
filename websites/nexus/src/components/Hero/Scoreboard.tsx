import { useDebug, useRenderCount } from './heroDebug';
import { type GameStats, useHeroStore } from './heroStore';
import { type StatConfig } from './heroGames';

const Hearts = ({ count }: { count: number }) => {
  const lives = Math.max(0, Math.min(6, count));

  return (
    <span key={count} className="stat-pop flex items-center gap-0.5 text-base leading-none">
      {Array.from({ length: lives }, (_, i) => (
        <span key={i} className="text-brand-300 drop-shadow-[0_0_4px_rgba(167,139,250,0.6)]">
          ♥
        </span>
      ))}
      {lives === 0 && <span className="text-zinc-600">☠</span>}
    </span>
  );
};

const StatCell = ({ label, statKey }: { label: string; statKey: keyof GameStats }) => {
  const [value] = useHeroStore(`game.${statKey}`);
  const debug = useDebug();
  const renders = useRenderCount();

  return (
    <div className="flex flex-col items-start">
      <span className="text-[9px] tracking-[0.18em] text-zinc-500 uppercase">{label}</span>
      {statKey === 'lives' ? (
        <Hearts count={value} />
      ) : (
        <span key={value} className="stat-pop text-brand-200 font-mono text-lg font-bold tabular-nums">
          {value}
        </span>
      )}
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
