import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

import type { ReactNode } from 'react';

// A "common mistake" callout — the wrong tool people reach for, and the cost of picking it.
const Trap = ({ children }: { children: ReactNode }) => (
  <div className="my-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
    <span className="mr-2 font-semibold text-amber-400">Common mistake</span>
    {children}
  </div>
);

const ChoosingApi = () => (
  <Prose>
    <p>
      nexus ships several primitives because different jobs have different costs. <strong>Most screens need only</strong>{' '}
      <code>createStoreHook</code> + <code>useStore</code>. The rest exist for a specific need — reach for them only when
      you hit it. This page maps each job to the right tool, and calls out the wrong one that&apos;s easy to grab by
      mistake (and what it costs you).
    </p>
    <p>If you remember one thing per axis:</p>
    <ul>
      <li>
        <strong>Reading?</strong> Re-render → <code>useStore</code>. Read in a callback → <code>useStoreGetter</code>.
        Shared/expensive compute → <code>createDerived</code>.
      </li>
      <li>
        <strong>Writing?</strong> Write-only → <code>useStoreSetter</code>. Mirror a prop in → <code>useStoreSync</code>.
      </li>
      <li>
        <strong>A map of items?</strong> Big &amp; edited often → <code>createEntityStore</code>. Otherwise{' '}
        <code>createEntityAdapter</code>.
      </li>
      <li>
        <strong>More than one store?</strong> Share live → scoped <code>inherit=&quot;live&quot;</code>. Reach a named
        one → <code>storeId</code>.
      </li>
    </ul>

    <h2 id="reading">Reading state in a component</h2>
    <p>Four ways to read — they differ in whether they re-render and whether the result is computed and shared.</p>
    <table>
      <thead>
        <tr>
          <th>I want to…</th>
          <th>Use</th>
          <th>Not</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Re-render when a value changes</td>
          <td>
            <code>useStore(&apos;path&apos;)</code>
          </td>
          <td>
            <code>useStoreGetter</code>
          </td>
          <td>A getter never subscribes — your UI won&apos;t update.</td>
        </tr>
        <tr>
          <td>Read inside a handler/effect, no re-render</td>
          <td>
            <code>useStoreGetter()</code>
          </td>
          <td>
            <code>useStore</code>
          </td>
          <td>
            <code>useStore</code> subscribes the component and re-renders it on every change of a value you only read on
            click.
          </td>
        </tr>
        <tr>
          <td>A small value derived from one path, single consumer</td>
          <td>
            <code>useStore(path, &#123; transformer &#125;)</code>
          </td>
          <td>
            <code>createDerived</code>
          </td>
          <td>Derived is shared/memoized machinery — overkill for one local transform.</td>
        </tr>
        <tr>
          <td>An expensive value shared across many components</td>
          <td>
            <code>createDerived</code> + <code>useDerived</code>
          </td>
          <td>
            a <code>transformer</code> in each component
          </td>
          <td>Derived computes once, memoizes, and wakes consumers only when the result changes.</td>
        </tr>
      </tbody>
    </table>
    <Trap>
      Reading a value with <code>useStore</code> just to use it in an <code>onClick</code> re-renders the component every
      time that value changes — for something you only read on click. Use <code>useStoreGetter()</code>.
    </Trap>

    <h2 id="writing">Writing state</h2>
    <p>If you already read a value reactively, use the setter it hands back. Otherwise pick by intent:</p>
    <table>
      <thead>
        <tr>
          <th>I want to…</th>
          <th>Use</th>
          <th>Not</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Update a value I already read with useStore</td>
          <td>the setter from that hook</td>
          <td>—</td>
          <td>You already have it; no extra hook.</td>
        </tr>
        <tr>
          <td>Write-only (toolbar, menu, handler), no re-render</td>
          <td>
            <code>useStoreSetter()</code>
          </td>
          <td>
            <code>useStore(path)</code>
          </td>
          <td>Reaching for useStore to get a setter subscribes the component to that path needlessly.</td>
        </tr>
        <tr>
          <td>Mirror a prop / external value INTO the store</td>
          <td>
            <code>useStoreSync(path, value)</code>
          </td>
          <td>
            <code>useEffect</code> + <code>setState</code>
          </td>
          <td>useStoreSync handles mount/render strategies and the enabled guard for you.</td>
        </tr>
        <tr>
          <td>Write from outside React</td>
          <td>
            <code>store.setState</code>
          </td>
          <td>—</td>
          <td>Imperative, no hook needed.</td>
        </tr>
      </tbody>
    </table>
    <Trap>
      <code>const [, setName] = useStore(&apos;user.name&apos;)</code> in a toolbar subscribes it to{' '}
      <code>user.name</code> — it re-renders on every name change even though it only writes. Use{' '}
      <code>useStoreSetter()</code>.
    </Trap>

    <h2 id="collections">Collections &amp; normalized data</h2>
    <p>
      Three ways to hold a map of entities. They look similar but have very different write costs — this is the most
      common wrong turn.
    </p>
    <table>
      <thead>
        <tr>
          <th>My map is…</th>
          <th>Use</th>
          <th>Not</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Small, edited occasionally; part of the main state tree</td>
          <td>
            <code>createEntityAdapter</code> + <code>setState</code>
          </td>
          <td>
            <code>createEntityStore</code>
          </td>
          <td>The adapter is simpler and keeps everything in one immutable tree (persist, time-travel just work).</td>
        </tr>
        <tr>
          <td>Large, edited often, rendered as a list of per-row components</td>
          <td>
            <code>createEntityStore</code> (<code>useOne</code>/<code>useIds</code>)
          </td>
          <td>
            <code>setState(&apos;items.&lt;id&gt;…&apos;)</code> / adapter
          </td>
          <td>
            An immutable write copies the whole map — <strong>O(n)</strong> per edit. The entity store mutates one entry
            and wakes only that row — <strong>O(1)</strong>.
          </td>
        </tr>
      </tbody>
    </table>
    <Trap>
      <code>createEntityAdapter</code> does <strong>not</strong> make writes faster — every <code>addOne</code>/
      <code>updateOne</code> still spreads the entire map (O(n)). It only removes boilerplate. For a big, frequently
      edited map, switch to <code>createEntityStore</code> — it&apos;s ~300× faster on a 2,000-item map and re-renders
      only the row you touched.
    </Trap>
    <CodeBlock
      code={`// O(n) per edit — fine for a small map, copies all keys on every write:
store.setState('todos', adapter.updateOne({ id, changes: { done: true } }));

// O(1) per edit — a per-id reactive collection; only that row re-renders:
const todos = createEntityStore<Todo>(seed);
todos.updateOne(id, { done: true });
const ids = todos.useIds();          // list re-renders only on add/remove
const todo = todos.useOne(id);       // a row re-renders only when ITS todo changes`}
    />

    <h2 id="multiple-stores">More than one store</h2>
    <p>Pick by how the scopes should relate, not by how many you have.</p>
    <table>
      <thead>
        <tr>
          <th>I want to…</th>
          <th>Use</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>A subtree that reads shared state live + has its own local state</td>
          <td>
            scoped <code>StoreProvider inherit=&quot;live&quot;</code>
          </td>
          <td>Reads fall through to the parent; writes delegate to the scope that owns the path. No prop drilling.</td>
        </tr>
        <tr>
          <td>A draft / edit-then-cancel form, isolated from the parent</td>
          <td>
            scoped <code>inherit=&quot;snapshot&quot;</code>
          </td>
          <td>Copies the parent once at mount, then diverges — later parent edits never leak in.</td>
        </tr>
        <tr>
          <td>Reach a specific ancestor store, even past a disconnected provider</td>
          <td>
            <code>id</code> + <code>useStoreById</code> / <code>&#123; storeId &#125;</code>
          </td>
          <td>Targets exactly that named store, no matter the nesting.</td>
        </tr>
        <tr>
          <td>Two genuinely independent state domains</td>
          <td>
            separate <code>createStore</code> instances
          </td>
          <td>Clearer ownership than cramming unrelated state into one tree.</td>
        </tr>
      </tbody>
    </table>

    <h2 id="async">Async data</h2>
    <p>
      Use <code>createAsync</code> when the fetched value should live in the store (so paths, derived values and persist
      all see it) and you want race-handling and status for free. Then choose the consumer hook by your UI:
    </p>
    <table>
      <thead>
        <tr>
          <th>I want to…</th>
          <th>Use</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Inline loading / error UI</td>
          <td>
            <code>useAsync(resource)</code>
          </td>
          <td>
            Returns <code>&#123; status, data, error &#125;</code> — render the states yourself.
          </td>
        </tr>
        <tr>
          <td>A Suspense boundary</td>
          <td>
            <code>useAsyncValue(resource)</code>
          </td>
          <td>Suspends while pending, throws to the nearest error boundary, returns the value when ready.</td>
        </tr>
        <tr>
          <td>Just fire a fetch and land it in state</td>
          <td>
            <code>createAsync</code> + <code>resource.run()</code>
          </td>
          <td>The latest call wins; the result is written to the bound path.</td>
        </tr>
      </tbody>
    </table>

    <h2 id="cross-cutting">Cross-cutting concerns</h2>
    <p>Logging, persistence, time-travel and validation all ride the same change substrate — pick by reach:</p>
    <table>
      <thead>
        <tr>
          <th>I want to…</th>
          <th>Use</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Persist, log, record history, or connect DevTools</td>
          <td>
            a <code>middleware</code> on <code>createStore</code>
          </td>
          <td>Batteries included, correct ordering, hydration handled.</td>
        </tr>
        <tr>
          <td>Validate / transform / block a write before it commits</td>
          <td>
            <code>beforeChange</code> (interceptor) → <code>CANCEL</code>
          </td>
          <td>Runs pre-commit; can rewrite the value or reject the write.</td>
        </tr>
        <tr>
          <td>A one-off observer of committed changes</td>
          <td>
            <code>store.subscribeChange</code>
          </td>
          <td>Lighter than a middleware for a single ad-hoc listener.</td>
        </tr>
      </tbody>
    </table>

    <h2 id="cheatsheet">Cheat sheet</h2>
    <p>The whole map, top to bottom:</p>
    <CodeBlock
      language="text"
      code={`Reading
  re-render on change ............ useStore(path)
  read in a callback ............. useStoreGetter()
  small local transform .......... useStore(path, { transformer })
  shared / expensive compute ..... createDerived + useDerived

Writing
  already read it reactively ..... setter from useStore
  write-only, no re-render ....... useStoreSetter()
  mirror a prop into the store ... useStoreSync(path, value)
  outside React .................. store.setState(path, value)

Map of entities
  small / occasional ............. createEntityAdapter + setState
  large / frequent / per-row ..... createEntityStore (useOne, useIds)

Multiple stores
  share parent state live ........ scoped inherit="live"
  draft / edit-then-cancel ....... scoped inherit="snapshot"
  reach a named ancestor ......... id + { storeId } / useStoreById
  independent domains ............ separate createStore

Async
  inline loading/error ........... useAsync
  Suspense ....................... useAsyncValue

Cross-cutting
  persist / log / history / devtools ... middleware
  validate / block a write ............. beforeChange + CANCEL
  one-off observer ..................... subscribeChange`}
    />
  </Prose>
);

export default ChoosingApi;
