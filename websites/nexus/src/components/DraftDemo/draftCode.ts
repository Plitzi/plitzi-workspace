export const DRAFT_CODE = `const { useStore, useStoreGetter, useStoreSetter } =
  createStoreHook<DraftState>();

function ProfileCard() {
  const [editing, setEditing] = useState(false);
  const setRoot = useStoreSetter();

  if (!editing) {
    return <button onClick={() => setEditing(true)}>Edit</button>;
  }

  // A snapshot scope is an isolated DRAFT copy of the root.
  // Edits live here; the root is untouched until you save.
  return (
    <StoreProvider inherit="snapshot">
      <Editor
        onSave={p => { setRoot('profile', p); setEditing(false); }}
        onCancel={() => setEditing(false)}   // discard the draft
      />
    </StoreProvider>
  );
}

function Editor({ onSave, onCancel }: Props) {
  const [name, setName] = useStore('profile.name'); // stays in the draft
  const get = useStoreGetter();

  return (
    <>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={() => onSave(get('profile'))}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </>
  );
}`;
