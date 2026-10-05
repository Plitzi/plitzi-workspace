import type { ReactNode } from 'react';

export type FormSectionProps = {
  title: string;
  /** What the section is for, in a line under its title. */
  hint?: ReactNode;
  children: ReactNode;
};

/** One part of the component's form: its title, what it is for, and its fields. */
const FormSection = ({ title, hint, children }: FormSectionProps) => (
  <section className="flex flex-col gap-2" aria-label={title}>
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{title}</span>
      {hint && <span className="text-xs text-gray-500 dark:text-zinc-400">{hint}</span>}
    </div>
    {children}
  </section>
);

export default FormSection;
