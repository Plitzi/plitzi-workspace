import { useCallback, useState } from 'react';

import CodeBlock from '../../CodeBlock';
import Segmented from '../../Segmented';
import Prose from '../Prose';
import { FRAMEWORK_GUIDES, FRAMEWORK_TABS } from './getting-started';

import type { FrameworkId } from './getting-started';

const VALID_FRAMEWORKS = new Set<string>(FRAMEWORK_TABS.map(tab => tab.id));

// Deep links from the landing page point here with `?fw=vue` etc.; open that tab on mount.
const readInitialFramework = (): FrameworkId => {
  if (typeof window === 'undefined') {
    return 'core';
  }

  const match = /[?&]fw=([a-z]+)/.exec(window.location.hash);
  const fw = match?.[1];

  return fw && VALID_FRAMEWORKS.has(fw) ? (fw as FrameworkId) : 'core';
};

const GettingStarted = () => {
  const [framework, setFramework] = useState<FrameworkId>(readInitialFramework);
  const handleChange = useCallback((id: string) => setFramework(id as FrameworkId), []);
  const ActiveGuide = FRAMEWORK_GUIDES[framework];

  return (
    <>
      <Prose>
        <p>
          <code>@plitzi/nexus</code> is a type-safe, framework-agnostic state core built on{' '}
          <code>useSyncExternalStore</code>. You subscribe to <strong>dot-notation paths</strong> and a component
          re-renders only when that exact value changes — no selectors, no reducers, no action types. The dot-path
          model is identical on every framework; only the binding entry differs.
        </p>

        <h2>Install</h2>
        <CodeBlock language="bash" code={`npm install @plitzi/nexus\n# or: yarn add @plitzi/nexus`} />
        <p>
          The package is ESM, tree-shakeable and SSR-safe. The root entry is React-free; <code>react</code> /{' '}
          <code>react-dom</code> (for <code>/react</code>) and <code>vue</code> (for <code>/vue</code>) are{' '}
          <em>optional</em> peer dependencies — install only the one your stack uses.
        </p>

        <h2>Pick your stack</h2>
      </Prose>

      <Segmented
        options={FRAMEWORK_TABS}
        value={framework}
        onChange={handleChange}
        className="my-6 flex w-full flex-wrap"
      />

      <Prose>
        <ActiveGuide />

        <h2>Next steps</h2>
        <ul>
          <li>
            <a href="#/docs/api">API reference</a> — every function and its signatures.
          </li>
          <li>
            <a href="#/docs/choosing">Choosing the right API</a> — which primitive for which job.
          </li>
          <li>
            <a href="#/docs/guides-nextjs">Patterns: Next.js</a> — App Router, server hydration, Server Actions.
          </li>
          <li>
            <a href="#/docs/testing">Testing</a> — how to test stores, composables and components.
          </li>
          <li>
            <a href="#/docs/migration">Migration</a> — coming from Zustand, Redux, Jotai or Valtio.
          </li>
          <li>
            <a href="#frameworks">Supported frameworks</a> on the landing page, and runnable examples in the repo.
          </li>
        </ul>
      </Prose>
    </>
  );
};

export default GettingStarted;
