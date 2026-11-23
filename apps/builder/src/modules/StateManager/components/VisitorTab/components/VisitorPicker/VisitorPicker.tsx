import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback } from 'react';

import Notice from '@pmodules/App/components/Notice';

import useCanvasVisitor from '../../../../hooks/useCanvasVisitor';

import type { CanvasVisitor } from '../../../../hooks/useCanvasVisitor';

const sameVisitor = (a: CanvasVisitor, b: CanvasVisitor): boolean =>
  a.kind === b.kind && (a.kind !== 'account' || (b.kind === 'account' && a.id === b.id));

/**
 * Who the canvas shows the page to: the editor's own session, a guest, or one of the space's test accounts — its roles,
 * and what they give, as a visitor holding them.
 */
const VisitorPicker = () => {
  const { visitor, choose, accounts, journeyOnCanvas } = useCanvasVisitor();
  const { addToast } = useToast();

  const handleChoose = useCallback(
    (next: CanvasVisitor) => () => {
      const problem = choose(next);
      if (problem) {
        addToast(problem, { appeareance: 'warning', autoDismiss: true, placement: 'top-right' });
      }
    },
    [choose, addToast]
  );

  const options: { visitor: CanvasVisitor; title: string; hint: string; icon: string }[] = [
    { visitor: { kind: 'editor' }, title: 'Your session', hint: 'The page as you are signed in', icon: 'fa-user-pen' },
    { visitor: { kind: 'guest' }, title: 'A guest', hint: 'No session: what anybody sees', icon: 'fa-user-secret' },
    ...accounts.map(account => ({
      visitor: { kind: 'account', id: account.id } as const,
      title: account.id,
      hint: account.roles?.length ? `Roles: ${account.roles.join(', ')}` : 'A test account with no role',
      icon: 'fa-id-badge'
    }))
  ];

  return (
    <div className="flex flex-col gap-2">
      {journeyOnCanvas && (
        <Notice tone="info">A journey is on the canvas and shows its own visitor; close it to choose one here.</Notice>
      )}
      <div
        className={clsx('flex flex-col gap-1', { 'pointer-events-none opacity-50': journeyOnCanvas })}
        role="radiogroup"
      >
        {options.map(option => {
          const picked = sameVisitor(option.visitor, visitor);

          return (
            <button
              key={option.visitor.kind === 'account' ? `account:${option.visitor.id}` : option.visitor.kind}
              type="button"
              role="radio"
              aria-checked={picked}
              className={clsx('flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-left', {
                'border-primary-400/60 bg-primary-400/10': picked,
                'border-ui-line hover:bg-ui-hover': !picked
              })}
              onClick={handleChoose(option.visitor)}
            >
              <i
                className={clsx(
                  'fa-solid w-4 text-center text-xs',
                  option.icon,
                  picked ? 'text-primary-text' : 'text-ui-fg-subtle'
                )}
              />
              <span className="flex min-w-0 grow flex-col">
                <span
                  className={clsx('truncate text-xs font-medium', { 'font-mono': option.visitor.kind === 'account' })}
                >
                  {option.title}
                </span>
                <span className="text-ui-fg-subtle truncate text-[11px]">{option.hint}</span>
              </span>
              {picked && <i className="fa-solid fa-check text-primary-text text-[10px]" />}
            </button>
          );
        })}
        {accounts.length === 0 && (
          <p className="text-ui-fg-subtle px-1 text-[11px]">
            Test accounts are declared in Tests → Test accounts: each one a visitor with roles of the space's.
          </p>
        )}
      </div>
    </div>
  );
};

export default VisitorPicker;
