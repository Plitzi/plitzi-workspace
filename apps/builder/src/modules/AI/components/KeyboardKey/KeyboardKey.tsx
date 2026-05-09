import clsx from 'clsx';

export type KeyboardKeyProps = { className?: string; commandChar?: boolean; char: string };

const KeyboardKey = ({ className, commandChar = true, char }: KeyboardKeyProps) => {
  return (
    <kbd
      className={clsx(
        'flex h-5.5 shrink-0 items-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-1 py-0 font-mono text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800',
        className
      )}
    >
      {commandChar && <span className="text-sm">⌘</span>}
      {char}
    </kbd>
  );
};

export default KeyboardKey;
