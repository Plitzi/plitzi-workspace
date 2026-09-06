import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import PlitziSdkWrapper from '@pcomponents/PlitziSdkWrapper';

import { usePageLayout } from '../../../Layout/useLayout';
import useSpaces from '../useSpaces';

type Credential = { state: 'loading' } | { state: 'ready'; webKey: string } | { state: 'failed'; message: string };

/**
 * One space, rendered.
 *
 * The credential is fetched here rather than carried on the list row. `GET /spaces` answers with the record, not
 * with the token — the 2023 build read `default_token.token` off it, a field the endpoint stopped returning — and
 * a token is short-lived anyway, so the right moment to ask for one is when a space is about to be rendered.
 */
const SpaceDetailsPage = () => {
  const { permanentUrl } = useParams<{ permanentUrl: string }>();
  const { getSpace, getWebKey, setActiveSpace, loading } = useSpaces();
  const space = permanentUrl ? getSpace(permanentUrl) : undefined;
  const [credential, setCredential] = useState<Credential>({ state: 'loading' });
  usePageLayout({ title: space?.name, pageClassName: 'p-0' });

  useEffect(() => {
    setActiveSpace(space);

    return () => setActiveSpace(undefined);
  }, [space, setActiveSpace]);

  useEffect(() => {
    if (!space) {
      return;
    }

    let cancelled = false;
    setCredential({ state: 'loading' });

    const fetchKey = async () => {
      const webKey = await getWebKey(space.id);
      if (cancelled) {
        return;
      }

      setCredential(
        webKey
          ? { state: 'ready', webKey }
          : { state: 'failed', message: 'Could not get a credential for this space. Try refreshing the list.' }
      );
    };

    void fetchKey();

    return () => {
      cancelled = true;
    };
  }, [space, getWebKey]);

  if (!space) {
    return (
      <div className="p-8 text-sm text-zinc-500">
        {loading ? 'Looking for that space…' : 'That space is not one this account can reach.'}
      </div>
    );
  }

  if (credential.state === 'failed') {
    return <div className="p-8 text-sm text-red-600 dark:text-red-400">{credential.message}</div>;
  }

  if (credential.state === 'loading') {
    return <div className="p-8 text-sm text-zinc-500">Opening {space.name}…</div>;
  }

  return <PlitziSdkWrapper className="flex grow flex-col" webKey={credential.webKey} />;
};

export default SpaceDetailsPage;
