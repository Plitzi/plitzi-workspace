import Benchmark from './components/Benchmark';
import CoreApi from './components/CoreApi';
import Docs from './components/Docs';
import Ecosystem from './components/Ecosystem';
import FeatureGrid from './components/FeatureGrid';
import Footer from './components/Footer';
import Hero from './components/Hero';
import LiveDemo from './components/LiveDemo';
import Nav from './components/Nav';
import StateTree from './components/StateTree';
import useMeta from './useMeta';
import { useHashRoute } from './useHashRoute';

const App = () => {
  const hash = useHashRoute();
  const isDocs = hash.startsWith('#/docs');

  useMeta({
    title: 'Reactive state you query by path',
    description:
      'Nexus treats state as a navigable tree: get, set and watch any value by its dot-path, re-rendering only the exact node that changed. Typed end to end, scoped stores, derived graph, time-travel — on useSyncExternalStore.'
  });

  if (isDocs) {
    return (
      <div className="min-h-screen">
        <Nav />
        <Docs hash={hash} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <CoreApi />
        <StateTree />
        <LiveDemo />
        <FeatureGrid />
        <Benchmark />
        <Ecosystem />
      </main>
      <Footer />
    </div>
  );
};

export default App;
