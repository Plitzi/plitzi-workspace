import declaration from './declaration';
import VariantItem from './VariantItem';
import BaseVariants from './Variants';

// The variant is a React component, so it is attached here rather than in the data-only declaration.
const Variants = Object.assign(BaseVariants, {
  ...declaration,
  plugins: {
    variantItem: VariantItem
  }
});

export default Variants;
