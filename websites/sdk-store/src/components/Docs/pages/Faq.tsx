import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const Faq = () => (
  <Prose>
    <p>Common questions and the mistakes that bite people first.</p>

    <h2>Do I need a StoreProvider?</h2>
    <p>
      Only for the hooks (<code>useStore</code> &amp; friends), which read the store from context. A plain{' '}
      <code>createStore</code> used imperatively (<code>getState</code> / <code>setState</code> / <code>subscribe</code>
      ) needs no provider at all.
    </p>

    <h2>Why isn’t my component re-rendering?</h2>
    <ul>
      <li>
        <strong>You subscribed to the wrong path.</strong> <code>useStore('user')</code> wakes on a new{' '}
        <code>user</code> reference; if you mutate <code>user.name</code> via <code>setState('user.name', …)</code> it
        does update, but reading <code>'user'</code> and mutating it in place would not. Always write through{' '}
        <code>setState</code>.
      </li>
      <li>
        <strong>You mutated state in place.</strong> Treat values as immutable — <code>setState</code> does the
        structural-sharing copy. Pushing into an array you got from <code>getState</code> won’t notify anyone.
      </li>
      <li>
        <strong>The value didn’t actually change.</strong> Writing the same reference is a no-op (by design) and won’t
        wake subscribers.
      </li>
    </ul>

    <h2>It re-renders too often.</h2>
    <p>
      Subscribe to a narrower path, or use a <code>transformer</code> to derive a primitive so the component only wakes
      when that primitive changes. For cross-path computed values use <code>createDerived</code> — it only notifies when
      the <em>result</em> changes. To read without subscribing at all, use <code>useStoreGetter</code>.
    </p>

    <h2>getState vs getPath — which?</h2>
    <p>
      <code>getState()</code> returns the whole merged state (and, in a scope chain, deep-merges parent + child).{' '}
      <code>getPath('a.b')</code> resolves a single path without materializing the full merge — cheaper, and what you
      want for one value.
    </p>

    <h2>How do I update many values without N re-renders?</h2>
    <p>
      Wrap the writes in <code>store.batch(fn)</code>. Reads inside still see each write immediately; subscribers wake
      once at the end.
    </p>
    <CodeBlock
      language="ts"
      code={`store.batch(() => {
  store.setState('a', 1);
  store.setState('b', 2);
  store.setState('c', 3);
}); // subscribers wake once`}
    />

    <h2>My useStoreHistory panel is empty.</h2>
    <p>
      History is only recorded when <code>historyMiddleware()</code> is added to the store. Add it to{' '}
      <code>middlewares</code>. Without it the hook returns an empty, no-op view and logs a development warning.
    </p>
    <CodeBlock language="ts" code={`createStore(initial, { middlewares: [historyMiddleware()] });`} />

    <h2>Redux DevTools shows nothing.</h2>
    <p>
      Add <code>reduxDevToolsMiddleware()</code> to the store and open the extension (your instance appears in its
      dropdown). The middleware is a deliberate no-op when the extension isn’t installed, so it’s safe in production.
    </p>

    <h2>What’s a scoped store?</h2>
    <p>
      A nested <code>StoreProvider</code> that shadows part of the state while still reading the rest live from its
      parent. Reads fall through the chain; writes target the scope that owns the key. Use <code>inherit="live"</code>{' '}
      to see parent updates, or <code>inherit="snapshot"</code> to freeze at mount.
    </p>

    <h2>Does it work with SSR?</h2>
    <p>
      Yes. It’s built on <code>useSyncExternalStore</code> with isomorphic layout effects and snapshot getters. The
      <code>persistMiddleware</code> falls back to a no-op storage on the server.
    </p>

    <h2>Can I use it without TypeScript?</h2>
    <p>
      Yes, but you lose the headline feature: path autocomplete and compile-time checking of every <code>setState</code>{' '}
      / <code>useStore</code> path. TypeScript is strongly recommended.
    </p>

    <h2>Is it fast at scale?</h2>
    <p>
      Notifying is O(depth of the path), not O(number of subscribers), so thousands of watchers on the same tree stay
      cheap. See the <a href="#benchmarks">Benchmarks</a> on the landing page.
    </p>
  </Prose>
);

export default Faq;
