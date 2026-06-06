import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const GuidesForms = () => (
  <Prose>
    <p>
      Forms are the most common place where granular state control pays off — every field is its own path, every error
      and touch flag lives in a typed tree, and you never re-render the whole form when one character changes.
    </p>

    <h2 id="simple-field">Simple field</h2>
    <p>
      A single <code>useStore('path')</code> replaces the controlled-component pattern. No local state, no context, no
      reducer — just a path into the store.
    </p>
    <CodeBlock
      code={`const { useStore } = createStoreHook<FormState>();

function EmailField() {
  const [email, setEmail] = useStore('contact.email');

  return (
    <label>
      Email
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
    </label>
  );
}`}
      demoId="forms-simple"
    />

    <h2 id="nested-fields">Nested fields &amp; arrays</h2>
    <p>
      Dynamic lists (line items, tags, attendees) map naturally to an array path. A sub-component extracted per row owns
      its <code>useCallback</code> — no inline arrows, no stale closures.
    </p>
    <CodeBlock
      code={`type LineItem = { id: string; product: string; qty: number };

type LineItemRowProps = {
  index: number;
};

const LineItemRow = ({ index }: LineItemRowProps) => {
  const [product, setProduct] = useStore(\`lineItems.\${index}.product\` as const);
  const [qty, setQty] = useStore(\`lineItems.\${index}.qty\` as const);

  const handleProduct = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setProduct(e.target.value),
    [setProduct]
  );

  const handleQty = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setQty(Number(e.target.value)),
    [setQty]
  );

  return (
    <div className="row">
      <input value={product} onChange={handleProduct} />
      <input type="number" value={qty} onChange={handleQty} />
    </div>
  );
};

function LineItems() {
  const [items, setItems] = useStore('lineItems');

  const addItem = useCallback(
    () => setItems((prev: LineItem[]) => [...prev, { id: genId(), product: '', qty: 1 }]),
    [setItems]
  );

  return (
    <fieldset>
      <legend>Line items</legend>
      {items.map((_, i) => <LineItemRow key={i} index={i} />)}
      <button onClick={addItem}>Add item</button>
    </fieldset>
  );
}`}
      demoId="forms-nested"
    />

    <h2 id="validation">Validation &amp; errors</h2>
    <p>
      Keep errors, touched flags, and dirty tracking in the same tree alongside values. Each piece lives on its own path
      so a validation run only re-renders the fields that actually changed.
    </p>
    <CodeBlock
      code={`type FormState = {
  contact: {
    email: string;
    age: number;
  };
  errors: {
    email?: string;
    age?: string;
  };
  touched: {
    email: boolean;
    age: boolean;
  };
};

function validate(form: FormState): FormState['errors'] {
  const errors: FormState['errors'] = {};
  if (!form.contact.email.includes('@')) errors.email = 'Invalid email';
  if (form.contact.age < 18) errors.age = 'Must be 18+';
  return errors;
}

function AgeField() {
  const [age, setAge] = useStore('contact.age');
  const [error] = useStore('errors.age');
  const [touched, setTouched] = useStore('touched.age');

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setAge(value);
      setTouched(true);
      // Re-validate after write — errors.age updates reactively.
    },
    [setAge, setTouched]
  );

  return (
    <label>
      Age
      <input type="number" value={age} onChange={handleChange} />
      {touched && error && <span className="error">{error}</span>}
    </label>
  );
}

// Re-validate on any change via subscribeChange:
store.subscribeChange(change => {
  if (change.path !== 'errors') {
    const errors = validate(store.getState() as FormState);
    store.setState('errors', errors);
  }
});`}
      demoId="forms-validation"
    />

    <h2 id="submit">Submit &amp; dirty detect</h2>
    <p>
      Compare the current state against a snapshot taken at mount to detect dirtiness. The <code>snapshot</code> scope
      mode is built exactly for this — freeze a copy of the initial values and diff at submit.
    </p>
    <CodeBlock
      code={`function FormWrapper() {
  return (
    <StoreProvider inherit="snapshot" value={initialState}>
      <Form />
    </StoreProvider>
  );
}

function Form() {
  const [state, setState] = useStore();
  const get = useStoreGetter();
  const pristine = useRef(get());                   // snapshot taken once on mount

  const isDirty = !shallowEqual(state, pristine.current);

  const handleSubmit = useCallback(async () => {
    if (!isDirty) return;
    await api.submit(pristine.current);             // send the latest values
    pristine.current = get();                       // new baseline after submit
  }, [isDirty, get]);

  return (
    <form onSubmit={handleSubmit}>
      <EmailField />
      <AgeField />
      <button type="submit" disabled={!isDirty}>
        {isDirty ? 'Save' : 'Saved'}
      </button>
    </form>
  );
}`}
      demoId="forms-submit"
    />
  </Prose>
);

export default GuidesForms;
