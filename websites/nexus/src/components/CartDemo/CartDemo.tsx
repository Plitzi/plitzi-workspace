import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import { CART_CODE } from './cartCode';
import CartItems from './components/CartItems';
import { CART_INITIAL } from './cartStore';

const CartDemo = () => (
  <ExampleCard
    title="Shopping cart"
    subtitle="useStore + useStoreSetter + derived totals"
    code={CART_CODE}
  >
    <StoreProvider value={CART_INITIAL}>
      <CartItems />
    </StoreProvider>
  </ExampleCard>
);

export default CartDemo;
