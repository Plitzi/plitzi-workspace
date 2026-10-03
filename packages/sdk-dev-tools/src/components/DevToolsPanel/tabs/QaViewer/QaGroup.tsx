import type { ReactNode } from 'react';

export type QaGroupProps = {
  title: string;
  icon: string;
  children: ReactNode;
  /** At the right of the title: an action over the whole group. */
  end?: ReactNode;
};

/** A titled box of tools. */
const QaGroup = ({ title, icon, children, end }: QaGroupProps) => (
  <section className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
      <span className="flex items-center gap-2">
        <i className={icon} />
        {title}
      </span>
      {end}
    </div>
    <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">{children}</div>
  </section>
);

export default QaGroup;
