import clsx from 'clsx';
import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import useSpaces from '../useSpaces';

import type { Space } from '../space';

const SpaceCard = ({ space }: { space: Space }) => (
  <Link
    to={`/spaces/view/${space.permanentUrl}`}
    className={clsx(
      'flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md',
      'dark:border-zinc-800 dark:bg-zinc-900'
    )}
  >
    <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{space.name}</span>
    <span className="truncate text-xs text-zinc-500">{space.permanentUrl}</span>
    {space.workspaceName && <span className="mt-2 text-xs text-zinc-400">{space.workspaceName}</span>}
  </Link>
);

const Section = ({ title, spaces }: { title: string; spaces: Space[] }) => {
  if (spaces.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {spaces.map(space => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </section>
  );
};

const SpaceIndexPage = () => {
  const { owned, guest, loading, error, reload } = useSpaces();
  usePageLayout({ title: 'Your spaces', pageClassName: 'p-6' });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your spaces</h1>

      {error !== undefined && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span>{error === 'offline' ? 'Could not reach Plitzi. This is the last list this window saw.' : error}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      <Section title="Yours" spaces={owned} />
      <Section title="Shared with you" spaces={guest} />

      {!loading && error === undefined && owned.length === 0 && guest.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nothing here yet. Create a space at plitzi.com and it will show up the next time this window refreshes.
        </p>
      )}
    </div>
  );
};

export default SpaceIndexPage;
