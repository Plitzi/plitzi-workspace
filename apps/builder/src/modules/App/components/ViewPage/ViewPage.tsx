import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';

import type { ReactNode } from 'react';

export type ViewPageProps = {
  /** Where "Back" goes — a form inside a view: the list it was opened from. */
  onBack?: () => void;
  backLabel?: string;
  /** The thing being edited. A list needs none: the tab above already names it. */
  title?: ReactNode;
  /** What this view is for, in a sentence. */
  description?: ReactNode;
  /** The view's own commands — its primary action last, at the right edge. */
  actions?: ReactNode;
  /** Scroll inside the page, or leave it to a child that pins its own footer. */
  scroll?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * One page of a view that replaces the canvas — Server, Settings: the same column, the same header, the same rhythm,
 * whichever subject is open, so moving between tabs moves nothing but the content.
 */
const ViewPage = ({
  onBack,
  backLabel = 'Back',
  title,
  description,
  actions,
  scroll = true,
  className,
  children
}: ViewPageProps) => {
  const hasHeader = [onBack, title, description, actions].some(Boolean);

  return (
    <div className={clsx('flex min-h-0 grow basis-0 flex-col', { 'overflow-y-auto': scroll })}>
      <div
        className={clsx(
          'mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 pt-2 pb-10',
          { 'min-h-0 grow': !scroll },
          className
        )}
      >
        {hasHeader && (
          <header className="flex flex-col gap-3">
            {onBack && (
              <Button
                size="xs"
                intent="secondary"
                border="none"
                className="-ml-2 self-start text-gray-500 dark:text-zinc-400"
                iconPlacement="before"
                onClick={onBack}
              >
                <Button.Icon icon="fa-solid fa-arrow-left" />
                {backLabel}
              </Button>
            )}
            <div className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 flex-col gap-1">
                {title && <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>}
                {description && (
                  <p className="max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-zinc-400">{description}</p>
                )}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
          </header>
        )}
        {children}
      </div>
    </div>
  );
};

export default ViewPage;
