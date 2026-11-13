import clsx from 'clsx';

import { isMac, modifierKey } from '../platform';

export type KeyboardKeyProps = { className?: string; commandChar?: boolean; char: string };

const KeyboardKey = ({ className, commandChar = true, char }: KeyboardKeyProps) => {
  return (
    <kbd
      className={clsx(
        'text-ui-fg-subtle dark:border-ui-line-strong dark:bg-ui-raised flex h-5.5 min-w-5.5 shrink-0 items-center justify-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-1 py-0 font-mono text-[11px]',
        className
      )}
    >
      {commandChar && <span className={clsx({ 'text-sm': isMac })}>{modifierKey}</span>}
      {char}
    </kbd>
  );
};

export default KeyboardKey;
