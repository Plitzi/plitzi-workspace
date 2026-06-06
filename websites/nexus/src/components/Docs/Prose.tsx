import type { ReactNode } from 'react';

// Styles plain semantic HTML (h2/h3/p/ul/code/table/a) so the doc pages can be written as readable markup. CodeBlock
// is a styled component and renders independently of these rules.
const Prose = ({ children }: { children: ReactNode }) => (
  <div className="[&_a]:text-brand-300 [&_code]:bg-ink-800 [&_code]:text-brand-200 [&_h2]:border-ink-800 [&_td]:border-ink-800 [&_th]:border-ink-800 [&_th]:bg-ink-900 max-w-none space-y-4 text-sm leading-relaxed text-zinc-300 [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-white [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
    {children}
  </div>
);

export default Prose;
