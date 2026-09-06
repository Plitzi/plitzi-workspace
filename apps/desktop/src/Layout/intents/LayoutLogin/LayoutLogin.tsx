import clsx from 'clsx';

import type { ReactNode } from 'react';

export type LayoutLoginProps = { children?: ReactNode; className?: string };

/**
 * The sign-in shell: one card, centred, on the brand gradient.
 *
 * The 2023 version was a two-column card whose left half was a photograph loaded from the bundle and a paragraph
 * of marketing copy. A desktop client is opened by somebody who already chose Plitzi, so the pitch is gone and
 * what is left is the form and enough of the brand to know which app this is.
 */
const LayoutLogin = ({ children, className }: LayoutLoginProps) => (
  <div
    className={clsx(
      'flex grow flex-col items-center justify-center bg-linear-160 from-indigo-700 via-indigo-600 to-sky-500 p-8',
      className
    )}
  >
    <div className="mb-8 flex items-center gap-3 text-white">
      <img src="https://cdn.plitzi.com/resources/img/favicon.svg" alt="" className="h-9 w-9" />
      <span className="text-3xl font-bold">Plitzi</span>
    </div>
    <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900">{children}</div>
  </div>
);

export default LayoutLogin;
