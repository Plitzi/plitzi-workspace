import declaration from './declaration';
import BaseDisclosure from './Disclosure';
import DisclosureSummary from './DisclosureSummary';

// The summary is a React component, so it is attached here rather than in the data-only declaration.
const Disclosure = Object.assign(BaseDisclosure, {
  ...declaration,
  plugins: { disclosureSummary: DisclosureSummary }
});

export default Disclosure;
