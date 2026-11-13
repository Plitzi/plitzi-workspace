import type { ServerPlay } from '../../hooks/useServerPlay';

export type ServerPlayCardProps = {
  play: ServerPlay;
  /** The journey's title, as its author gave it. */
  titleOf: (id: string) => string;
};

/**
 * The journey the server is playing now, as it plays: which, how far, and the page after its last step — what the run
 * will answer, seen while it is made.
 */
const ServerPlayCard = ({ play, titleOf }: ServerPlayCardProps) => {
  const { now, of } = play;

  return (
    <section
      aria-label="Playing on the server"
      className="border-ui-line-strong flex flex-col gap-2 rounded-lg border p-3"
    >
      <span className="text-primary-700 dark:text-primary-200 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        On the server · journey {now.at + 1} of {of}
      </span>
      <span className="text-ui-fg truncate text-sm font-medium">{titleOf(now.test)}</span>
      <span className="text-ui-fg-subtle text-xs">
        Step {now.played} of {now.steps}
      </span>
      {now.frame && (
        <img
          src={now.frame}
          alt={`The page after step ${String(now.played)}`}
          className="border-ui-line-strong max-h-48 w-full rounded border object-contain object-top"
        />
      )}
    </section>
  );
};

export default ServerPlayCard;
