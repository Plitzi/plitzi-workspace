import Benchmark from './components/Benchmark';
import CodeShowcase from './components/CodeShowcase';
import Ecosystem from './components/Ecosystem';
import FeatureGrid from './components/FeatureGrid';
import Footer from './components/Footer';
import Hero from './components/Hero';
import LiveDemo from './components/LiveDemo';
import Nav from './components/Nav';
import RealWorld from './components/RealWorld';

const App = () => (
  <div className="min-h-screen">
    <Nav />
    <main>
      <Hero />
      <FeatureGrid />
      <CodeShowcase />
      <LiveDemo />
      <RealWorld />
      <Benchmark />
      <Ecosystem />
    </main>
    <Footer />
  </div>
);

export default App;
