// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PublishSheet from './PublishSheet';

import type { SpaceSnapshot, SpaceTarget, SpaceVersionChanges } from '@plitzi/sdk-shared';

const target = (domain: string, extra: Partial<SpaceTarget> = {}): SpaceTarget => ({
  id: 1,
  domain,
  verified: true,
  plitziOwned: false,
  ownAddress: false,
  mode: 'ssr',
  provider: 'ssr',
  providerLabel: 'Plitzi',
  atomic: true,
  environment: 'main',
  revision: null,
  serves: { environment: 'main', revision: 0 },
  rollback: null,
  config: null,
  credential: null,
  bucket: null,
  protected: false,
  hook: false,
  lastDeploy: null,
  running: null,
  update: null,
  locked: null,
  required: null,
  ...extra
});

const snapshot = (revision: number, description: string): SpaceSnapshot => ({
  environment: 'production',
  revision,
  description,
  publishedAt: '2026-11-16T10:00:00.000Z',
  by: null,
  domains: [],
  previewUrl: `https://acme--r${String(revision)}.plitzi.local/`
});

/** Two pages changed in the editor since production v3. */
const CHANGED: SpaceVersionChanges = {
  pages: { added: [], removed: [], changed: ['home', 'menu'] },
  layouts: 0,
  components: 0,
  styles: false,
  fonts: false,
  settings: false,
  plugins: { added: [], removed: [], changed: [] },
  actions: 0,
  connectors: 0,
  functions: false,
  runtime: false,
  total: 2
};

const DOMAIN = 'www.acme.com';
const OWN = target('acme.plitzi.local', { ownAddress: true, plitziOwned: true });
/** The space's targets as the platform lists them: the domain shows every save unless a test says otherwise. */
const listed = { targets: [OWN, target(DOMAIN)] };
const PRODUCTION = [snapshot(3, 'Spring menu'), snapshot(2, 'Opening')];

const mutate =
  vi.fn<
    (name: string, variables: Record<string, unknown>, unwrap: boolean) => Promise<{ result: Record<string, unknown> }>
  >();

vi.mock('@pmodules/Network/hooks/useBuilderNetwork', () => ({ default: () => ({ mutate, webId: 7 }) }));
// Each query the sheet asks, answered as the platform would: the production versions, and nothing else of note.
vi.mock('@pmodules/Network/hooks/useGraphQL', () => ({
  default: (name: string | null, _select: unknown, variables?: { environment?: string | null }) => {
    const refresh = () => Promise.resolve(undefined);
    if (name === 'SpaceSnapshots') {
      return {
        data: variables?.environment === 'production' || variables?.environment === null ? PRODUCTION : [],
        isLoading: false,
        mutate: refresh
      };
    }

    if (name === 'SpaceReleases') {
      return { data: { releases: [], rollback: null }, isLoading: false, mutate: refresh };
    }

    return { data: name === 'SpaceDeployments' || name === 'SpaceCredentials' ? [] : undefined, mutate: refresh };
  }
}));
vi.mock('@pmodules/Space/hooks/useSpaceEntitlements', () => ({ default: () => ({ locked: () => undefined }) }));
vi.mock('@pmodules/Space/hooks/useSpaceIssues', () => ({
  default: () => ({ refresh: () => Promise.resolve({ errors: [], warnings: [], suggestions: [] }) })
}));
vi.mock('@pmodules/Space/hooks/useShowSpaceIssues', () => ({ default: () => vi.fn() }));
vi.mock('../../hooks/useLatestSnapshots', async importOriginal => ({
  ...(await importOriginal<typeof import('../../hooks/useLatestSnapshots')>()),
  default: () => ({
    byEnvironment: { development: undefined, staging: undefined, production: PRODUCTION[0] },
    refresh: () => Promise.resolve()
  })
}));
vi.mock('../../hooks/useSpaceTargets', () => ({
  default: () => ({
    targets: { targets: listed.targets, providers: [], targetFields: [] },
    loading: false,
    refresh: () => Promise.resolve()
  })
}));
vi.mock('../../components/ChangesSummary', () => ({
  default: () => null,
  useVersionChanges: () => ({ changes: CHANGED, loading: false })
}));

const calls = () => mutate.mock.calls.map(([name, variables]) => [name, variables]);

const publish = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await waitFor(() => {
    expect(screen.getByText(/now shows/u)).toBeTruthy();
  });
};

describe('PublishSheet', () => {
  beforeEach(() => {
    mutate.mockReset();
    mutate.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'SpacePublish'
          ? { result: { environment: 'production', revision: 4 } }
          : { result: { domain: DOMAIN, deployId: null } }
      )
    );
  });

  afterEach(() => {
    cleanup();
    listed.targets = [OWN, target(DOMAIN)];
  });

  it('publishes the latest changes: kept as a new production version, then the domain follows production', async () => {
    render(<PublishSheet onClose={vi.fn()} />);
    await publish();

    expect(calls()).toEqual([
      ['SpacePublish', { environment: 'production', description: 'Published from the builder' }],
      ['SpaceDeploy', { environment: 'production', domain: DOMAIN, credentialIdentifier: '', deploy: false }]
    ]);
    expect(screen.getByText(`${DOMAIN} now shows the latest Production version (v4 now).`)).toBeTruthy();
  });

  it('follows the latest version as it is, keeping nothing, when the changes are left in the editor', async () => {
    render(<PublishSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    await publish();

    expect(calls()).toEqual([
      ['SpaceDeploy', { environment: 'production', domain: DOMAIN, credentialIdentifier: '', deploy: false }]
    ]);
  });

  it('stays on a specific version, named', async () => {
    render(<PublishSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /A specific version/u }));
    fireEvent.click(screen.getByRole('radio', { name: /Opening/u }));
    await publish();

    expect(calls()).toEqual([
      [
        'SpaceDeploy',
        { environment: 'production', domain: DOMAIN, revision: 2, credentialIdentifier: '', deploy: false }
      ]
    ]);
    expect(screen.getByText(`${DOMAIN} now shows Production v2.`)).toBeTruthy();
  });

  it('says a domain that shows every save already shows Draft, with nothing to press', () => {
    render(<PublishSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Draft/u }));

    expect(screen.queryByText('Version')).toBeNull();
    expect(screen.getByText(`${DOMAIN} already shows it.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows every save on Draft, with no version, on a domain that showed a version', async () => {
    listed.targets = [
      OWN,
      target(DOMAIN, { environment: 'production', serves: { environment: 'production', revision: 3 } })
    ];
    render(<PublishSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Draft/u }));
    await publish();

    expect(calls()).toEqual([
      ['SpaceDeploy', { environment: 'main', domain: DOMAIN, credentialIdentifier: '', deploy: false }]
    ]);
  });

  it('lists the space’s own address apart, never as a domain to publish to', () => {
    render(<PublishSheet onClose={vi.fn()} />);

    expect(screen.getByText('acme.plitzi.local')).toBeTruthy();
    expect(screen.queryAllByRole('radio', { name: /acme\.plitzi\.local/u })).toHaveLength(0);
    expect(screen.getByRole('radio', { name: new RegExp(DOMAIN.replaceAll('.', '\\.'), 'u') })).toBeTruthy();
  });
});
