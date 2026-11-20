import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Notice from '@pmodules/App/components/Notice';

import AudienceFacts from './components/AudienceFacts';
import ExperimentVariants from './components/ExperimentVariants';
import useCanvasVisitor from '../../hooks/useCanvasVisitor';

import type { CanvasVisitor } from '../../hooks/useCanvasVisitor';

type AuthSource = { isAuthenticated?: boolean; details?: Record<string, unknown> };

const sameVisitor = (a: CanvasVisitor, b: CanvasVisitor): boolean =>
  a.kind === b.kind && (a.kind !== 'account' || (b.kind === 'account' && a.id === b.id));

const listed = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'string' && value ? value : '—';

/**
 * Who the canvas shows the page to: the editor's own session, a guest, or one of the space's test accounts — its roles,
 * and what they give, as a visitor holding them. What the page then reads of its visitor (`auth`) is shown under it.
 */
const VisitorTab = () => {
  const { visitor, choose, accounts, journeyOnCanvas } = useCanvasVisitor();
  const [auth] = useBuilderStore('runtime.sources.auth');
  const { addToast } = useToast();
  const source: AuthSource = auth ?? {};

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
    <div className="flex flex-col gap-3">
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
      <Notice tone="info">
        The canvas’s preview shows the page to this visitor: the audience variant they match and the A/B variant chosen
        below. While editing, each test and audience shows the variant its own settings name.
      </Notice>
      <AudienceFacts />
      <ExperimentVariants />
      <section className="border-ui-line flex flex-col gap-1 border-t pt-2">
        <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">
          What the page reads
        </h6>
        {[
          ['Signed in', source.isAuthenticated ? 'yes' : 'no'],
          ['Username', listed(source.details?.username)],
          ['Email', listed(source.details?.email)],
          ['Roles', listed(source.details?.roles)],
          ['Permissions', listed(source.details?.permissions)]
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2 px-1 text-[11px]">
            <span className="text-ui-fg-subtle w-20 shrink-0">{label}</span>
            <span className="text-ui-fg min-w-0 truncate font-mono" title={value}>
              {value}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
};

export default VisitorTab;
