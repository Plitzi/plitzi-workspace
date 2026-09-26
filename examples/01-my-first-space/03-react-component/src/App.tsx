import { useState } from 'react';

import { offlineData } from '@plitzi/example-space/browser';
import PlitziSdk from '@plitzi/plitzi-sdk';

import styles from './styles';

/** Plitzi as a COMPONENT, which is the difference from `render()`.
 *
 *  `render()` takes over a container and owns the React root — right when Plitzi *is* the page. Here your app
 *  owns the root, and `<PlitziSdk>` sits in your tree beside your own components: it re-renders with your state,
 *  lives inside your layout, and can be mounted, unmounted or swapped like anything else.
 *
 *  Same props either way — `render()` just forwards them. */
const App = () => {
  const [environment, setEnvironment] = useState<'main' | 'staging'>('main');
  const [visible, setVisible] = useState(true);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <strong>Your app</strong>
        <span style={styles.spacer} />
        {/* Ordinary React state driving Plitzi's props — nothing Plitzi-specific about it. */}
        <label style={styles.control}>
          environment&nbsp;
          <select value={environment} onChange={event => setEnvironment(event.target.value as 'main' | 'staging')}>
            <option value="main">main</option>
            <option value="staging">staging</option>
          </select>
        </label>
        <button type="button" style={styles.control} onClick={() => setVisible(current => !current)}>
          {visible ? 'Unmount' : 'Mount'} Plitzi
        </button>
      </header>

      <main style={styles.main}>
        <aside style={styles.aside}>
          <p style={styles.asideText}>This panel is yours. The space renders beside it, in the same React tree.</p>
        </aside>

        <section style={styles.canvas}>
          {/* `renderMode="raw"` (the default, said here so it reads) renders into this tree. `iframe` isolates the
              space completely — the choice for a page you do not control, pointless when the page is yours. */}
          {/* `debugMode` is this page authorizing the dev tools — the badge, and shift+alt+D for the panel. */}
          {visible && (
            <PlitziSdk offlineMode offlineData={offlineData} environment={environment} renderMode="raw" debugMode />
          )}
          {!visible && <p style={styles.asideText}>Plitzi is unmounted.</p>}
        </section>
      </main>
    </div>
  );
};

export default App;
