import type { ReactNode } from 'react';

export type InspectorSectionProps = {
  title: string;
  /** One line under the title, saying what the section is for. */
  hint?: string;
  children: ReactNode;
};

/** One part of the inspector: its title, what it is for, and what it holds. */
const InspectorSection = ({ title, hint, children }: InspectorSectionProps) => (
  <section className="border-ui-line flex flex-col gap-2.5 border-b px-4 py-4 last:border-b-0" aria-label={title}>
    <div className="flex flex-col gap-0.5">
      <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wide uppercase">{title}</span>
      {hint && <span className="text-ui-fg-subtle text-[11px]">{hint}</span>}
    </div>
    {children}
  </section>
);

export default InspectorSection;
