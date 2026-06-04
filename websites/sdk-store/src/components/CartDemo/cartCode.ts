export const CART_CODE = `const { useStore, useStoreSetter } = createStoreHook<CartState>();

function Cart() {
  // One subscription to the items map; derive totals in render.
  const [items] = useStore('items');
  const total = Object.values(items).reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <>
      {Object.entries(items).map(([id, item]) => <Row key={id} id={id} {...item} />)}
      <strong>Total: \${total}</strong>
    </>
  );
}

function Row({ id, qty }: RowProps) {
  const setState = useStoreSetter();
  const setQty = (n: number) => setState(\`items.\${id}.qty\`, Math.max(0, n));

  return (
    <>
      <button onClick={() => setQty(qty - 1)}>−</button>
      {qty}
      <button onClick={() => setQty(qty + 1)}>+</button>
    </>
  );
}`;
