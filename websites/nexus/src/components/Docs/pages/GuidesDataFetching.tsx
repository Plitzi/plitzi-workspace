import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const GuidesDataFetching = () => (
  <Prose>
    <p>
      @plitzi/nexus ships <code>createAsync</code> — a primitive that runs a fetch, lands the result in the store, and
      exposes a reactive <code>&#123; status, data, error &#125;</code> view. Every path subscriber, derived value, and
      middleware sees the resolved data.
    </p>

    <h2 id="basic-fetch">Basic fetch</h2>
    <p>
      <code>createAsync</code> binds a fetcher to a store path. The <code>immediate</code> option kicks off the request on
      creation; otherwise call <code>resource.run(args)</code> manually.
    </p>
    <CodeBlock
      code={`import { createAsync } from '@plitzi/nexus';
import { useAsync } from '@plitzi/nexus/react';

type State = { user: User | null };
const store = createStore<State>({ user: null });

const userResource = createAsync(
  store,
  'user',                              // path where the result lands
  (id: string) => fetch(\`/api/users/\${id}\`).then(r => r.json()),
  { immediate: ['42'] }                // fetch user 42 right away
);

// In a component — reactive status + data:
function Profile() {
  const { status, data, error } = useAsync(userResource);

  if (status === 'pending') return <Spinner />;
  if (status === 'error') return <Error err={error} />;

  return <span>{data?.name}</span>;
}

// Or suspend — same hook, different semantics:
import { useAsyncValue } from '@plitzi/nexus/react';

function ProfileName() {
  const user = useAsyncValue(userResource);  // throws while pending
  return <span>{user.name}</span>;
}`}
      demoId="fetch-basic"
    />

    <h2 id="race-conditions">Race conditions &amp; stale requests</h2>
    <p>
      <code>createAsync</code> tracks the latest invocation internally. If <code>run</code> is called again before the
      previous request finishes, only the <strong>latest</strong> response is written — stale responses are discarded
      automatically. No cancelled-abort boilerplate needed for the common case.
    </p>
    <CodeBlock
      code={`const searchResource = createAsync(
  store,
  'search.results',
  (q: string) => api.search(q),
);

// Fast-typing in a search box — each keystroke calls run().
// If response for "reac" arrives after response for "react",
// the stale "reac" response is silently dropped.
function SearchBox() {
  const { status, data } = useAsync(searchResource);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      searchResource.run(e.target.value);
    },
    [],
  );

  return (
    <>
      <input onChange={handleChange} placeholder="Search…" />
      {status === 'pending' && <Spinner />}
      {data && <Results items={data} />}
    </>
  );
}`}
      demoId="fetch-race"
    />

    <h2 id="dependent-queries">Dependent queries</h2>
    <p>
      Because the fetched data lands in the store tree, a second fetch can read the first result from its path — no
      prop-drilling, no <code>useEffect</code> coordination. Derived values and path subscriptions bridge them
      reactively.
    </p>
    <CodeBlock
      code={`const projectResource = createAsync(
  store,
  'project',
  (id: string) => api.getProject(id),
);

// Second resource depends on project.ownerId — it reads the
// store reactively via a derived value or subscribePath.
const ownerResource = createAsync(
  store,
  'project.owner',
  (_: void) => {
    const project = store.getPath('project');
    return api.getUser(project.ownerId);
  },
);

// Trigger the chain: fetch project, then fetch owner.
function ProjectView({ id }: { id: string }) {
  const project = useAsync(projectResource);
  const owner = useAsync(ownerResource);

  useEffect(() => {
    projectResource.run(id);
  }, [id]);

  // When project resolves, ownerResource sees the new
  // project.ownerId on its next run() call.
  useEffect(() => {
    if (project.status === 'success') {
      ownerResource.run();
    }
  }, [project.status]);

  if (project.status === 'pending') return <Spinner />;
  if (owner.status === 'pending') return <Spinner />;

  return <span>{owner.data?.name}</span>;
}`}
      demoId="fetch-dependent"
    />

    <h2 id="mutation">Mutations (POST / PUT / DELETE)</h2>
    <p>
      Mutations are just fetches that write to a different path or clear a cache path. The same <code>createAsync</code>{' '}
      primitive handles them — call <code>resource.run()</code> and read the result reactively.
    </p>
    <CodeBlock
      code={`const updateUserResource = createAsync(
  store,
  'user',
  (body: { name: string }) =>
    fetch('/api/user', {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then(r => r.json()),
);

function ProfileEditor() {
  const [name, setName] = useStore('user.name');
  const { status, error } = useAsync(updateUserResource);

  const handleSave = useCallback(() => {
    updateUserResource.run({ name });
  }, [name]);

  return (
    <>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleSave} disabled={status === 'pending'}>
        {status === 'pending' ? 'Saving…' : 'Save'}
      </button>
      {error && <span className="error">{error.message}</span>}
    </>
  );
}`}
      demoId="fetch-mutation"
    />
  </Prose>
);

export default GuidesDataFetching;
