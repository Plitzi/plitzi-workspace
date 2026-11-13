import Button from '@plitzi/plitzi-ui/Button';

export type MotionSummaryProps = {
  /** What the element will do, in words — or why it cannot yet. */
  sentence: string;
  problems: string[];
  /** Whether the canvas is playing the motion, rather than holding it still. */
  playing: boolean;
  onPlay: () => void;
};

/** The choices read back as one sentence, and the way to watch them on the canvas, which is otherwise still. */
const MotionSummary = ({ sentence, problems, playing, onPlay }: MotionSummaryProps) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-ui-fg m-0 min-w-0 grow basis-48 text-xs">
        {sentence}
      </p>
      <Button size="xs" intent="secondary" disabled={problems.length > 0} onClick={onPlay}>
        {playing ? 'Play again' : 'Play on the canvas'}
      </Button>
    </div>
    {problems.length > 0 && (
      <span role="alert" className="text-xs text-red-600 dark:text-red-400">
        {problems.join(' · ')}
      </span>
    )}
    <span className="text-ui-fg-subtle text-xs">
      {playing
        ? 'The canvas is playing the motion; ⏸ in the header holds it still again.'
        : 'The canvas holds motion still while you edit.'}{' '}
      Only opacity and position move, and a visitor who asked for less motion sees it already in place.
    </span>
  </>
);

export default MotionSummary;
