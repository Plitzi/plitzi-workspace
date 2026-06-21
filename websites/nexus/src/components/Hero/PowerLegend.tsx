import { type PowerInfo } from './heroGames';

// Compact key to the falling power-ups, so the badge a player catches mid-game actually means something.
const PowerLegend = ({ powerups }: { powerups: PowerInfo[] }) => (
  <div className="border-ink-700/70 bg-ink-900/70 pointer-events-auto flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 backdrop-blur-md">
    <span className="text-[8px] tracking-[0.2em] text-zinc-500 uppercase">Power-ups</span>
    {powerups.map(power => (
      <div key={power.letter} className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px] font-bold"
          style={{ color: power.color, borderColor: power.color, backgroundColor: `${power.color}1f` }}
        >
          {power.letter}
        </span>
        <span className="text-[10px] text-zinc-400">{power.label}</span>
      </div>
    ))}
  </div>
);

export default PowerLegend;
