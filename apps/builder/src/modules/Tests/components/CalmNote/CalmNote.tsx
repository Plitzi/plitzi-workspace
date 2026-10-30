import type { ReactNode } from 'react';

export type CalmNoteProps = {
  children: ReactNode;
  /** Where to go for more, as a link after the words: a plan that gives it. */
  link?: { label: string; href: string };
};

/**
 * Something the area cannot do now, said calmly beside where it was asked — amber and informative, never red: nothing
 * broke, and the rest goes on as it was.
 */
const CalmNote = ({ children, link }: CalmNoteProps) => (
  <p
    role="status"
    className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
  >
    <i className="fa-solid fa-circle-info mt-0.5 text-amber-500" />
    <span>
      {children}
      {link && (
        <>
          {' '}
          <a href={link.href} target="_blank" rel="noreferrer noopener" className="font-medium underline">
            {link.label}
          </a>
        </>
      )}
    </span>
  </p>
);

export default CalmNote;
