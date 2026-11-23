import { useBuilderStore } from '@plitzi/sdk-shared/store';

type AuthSource = { isAuthenticated?: boolean; details?: Record<string, unknown> };

const listed = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'string' && value ? value : '—';

/** What the page reads of its visitor (`auth`) as the canvas shows it: signed in or not, and who. */
const PageReads = () => {
  const [auth] = useBuilderStore('runtime.sources.auth');
  const source: AuthSource = auth ?? {};

  return (
    <section className="border-ui-line flex flex-col gap-1 border-t pt-2">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">What the page reads</h6>
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
  );
};

export default PageReads;
