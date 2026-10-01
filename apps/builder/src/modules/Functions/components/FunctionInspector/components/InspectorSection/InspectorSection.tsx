import type { ReactNode } from 'react';

export type InspectorSectionProps = {
  title: string;
  /** One line under the title, saying what the section is for. */
  hint?: string;
  children: ReactNode;
};

/** One part of the inspector: its title, what it is for, and what it holds. */
const InspectorSection = ({ title, hint, children }: InspectorSectionProps) => (
  <section
    className="flex flex-col gap-2.5 border-b border-gray-200 px-4 py-4 last:border-b-0 dark:border-zinc-800"
    aria-label={title}
  >
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
        {title}
      </span>
      {hint && <span className="text-[11px] text-gray-500 dark:text-zinc-400">{hint}</span>}
    </div>
    {children}
  </section>
);

export default InspectorSection;
