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
      <span className="text-ui-fg text-sm font-semibold">{title}</span>
      {hint && <span className="text-ui-fg-subtle text-xs">{hint}</span>}
    </div>
    {children}
  </section>
);

export default FormSection;
