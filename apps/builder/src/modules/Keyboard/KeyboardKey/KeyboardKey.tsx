import clsx from 'clsx';

import { isMac, modifierKey } from '../platform';

export type KeyboardKeyProps = { className?: string; commandChar?: boolean; char: string };

const KeyboardKey = ({ className, commandChar = true, char }: KeyboardKeyProps) => {
  return (
    <kbd
      className={clsx(
        'flex h-5.5 min-w-5.5 shrink-0 items-center justify-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-1 py-0 font-mono text-[11px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800',
        className
      )}
    >
      {commandChar && <span className={clsx({ 'text-sm': isMac })}>{modifierKey}</span>}
      {char}
    </kbd>
  );
};

export default KeyboardKey;
