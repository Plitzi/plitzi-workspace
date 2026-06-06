import { CART_PRODUCT_IDS, useCart } from '../../cartStore';
import CartItemRow from '../CartItemRow';

const CartItems = () => {
  const [items] = useCart('items');

  const count = CART_PRODUCT_IDS.reduce((sum, id) => sum + items[id].qty, 0);
  const total = CART_PRODUCT_IDS.reduce((sum, id) => sum + items[id].price * items[id].qty, 0);

  return (
    <div>
      <div>
        {CART_PRODUCT_IDS.map(id => (
          <CartItemRow key={id} id={id} name={items[id].name} price={items[id].price} qty={items[id].qty} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-700 bg-ink-950 px-4 py-3">
        <span className="text-sm text-zinc-400">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
        <span className="font-mono text-lg font-bold text-white">${total}</span>
      </div>
    </div>
  );
};

export default CartItems;
