import Benchmark from './components/Benchmark';
import CodeShowcase from './components/CodeShowcase';
import Docs from './components/Docs';
import Ecosystem from './components/Ecosystem';
import FeatureGrid from './components/FeatureGrid';
import Footer from './components/Footer';
import Hero from './components/Hero';
import LiveDemo from './components/LiveDemo';
import Nav from './components/Nav';
import RealWorld from './components/RealWorld';
import UseCases from './components/UseCases';
import useMeta from './useMeta';
import { useHashRoute } from './useHashRoute';

const App = () => {
  const hash = useHashRoute();
  const isDocs = hash.startsWith('#/docs');

  useMeta({
    title: 'A tiny, type-safe React store',
    description:
      'Path-based subscriptions, scoped stores, and time-travel. Fine-grained by default — O(depth) updates that scale to millions of items. Built on useSyncExternalStore.'
  });

  return (
    <div className="min-h-screen">
      <Nav />
      {isDocs ? (
        <Docs hash={hash} />
      ) : (
        <main>
          <Hero />
          <UseCases />
          <FeatureGrid />
          <CodeShowcase />
          <LiveDemo />
          <RealWorld />
          <Benchmark />
          <Ecosystem />
        </main>
      )}
      <Footer />
    </div>
  );
};

export default App;
