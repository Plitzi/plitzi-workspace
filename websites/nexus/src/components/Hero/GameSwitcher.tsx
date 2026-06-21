import { type GameDef } from './heroGames';

export type GameSwitcherProps = {
  games: GameDef[];
  active: string;
  onSelect: (id: string) => void;
};

const GameSwitcher = ({ games, active, onSelect }: GameSwitcherProps) => (
  <div className="border-ink-700/70 bg-ink-900/70 pointer-events-auto inline-flex items-center gap-1 rounded-full border p-1 backdrop-blur-md">
    {games.map(game => (
      <button
        key={game.id}
        type="button"
        onClick={() => onSelect(game.id)}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
          active === game.id ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'
        }`}
      >
        {game.name}
      </button>
    ))}
  </div>
);

export default GameSwitcher;
