import BaseAbTest from './AbTest';
import AbTestVariant from './AbTestVariant';
import declaration from './declaration';

// The variant is a React component, so it is attached here rather than in the data-only declaration.
const AbTest = Object.assign(BaseAbTest, {
  ...declaration,
  plugins: {
    abTestVariant: AbTestVariant
  }
});

export default AbTest;
