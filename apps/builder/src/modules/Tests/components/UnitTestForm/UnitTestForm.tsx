import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useState } from 'react';

import Notice from '@pmodules/App/components/Notice';
import ViewPage from '@pmodules/App/components/ViewPage';
import ViewSection from '@pmodules/App/components/ViewSection';

import { UNIT_KINDS, emptyOf, expectationOf, moved, valueText } from '../../helpers';
import KindRow from '../KindRow';

import type { Row } from '../../helpers';
import type { UnitTest } from '@plitzi/sdk-shared';

export type UnitTestFormProps = {
  test: UnitTest;
  elements: { value: string; label: string }[];
  /** Saves it; answers why it could not be, or nothing once it is. */
  onSave: (test: UnitTest) => Promise<string | undefined>;
  onBack: () => void;
};

/** A unit test written: its element, the state it is given, and what must hold of the element then. */
const UnitTestForm = ({ test, elements, onSave, onBack }: UnitTestFormProps) => {
  const [title, setTitle] = useState(test.title);
  const [element, setElement] = useState(test.element);
  const [state, setState] = useState(valueText(test.given?.state ?? {}));
  const [sources, setSources] = useState(valueText(test.given?.sources ?? {}));
  const [rows, setRows] = useState<Row[]>(test.expect.map(each => ({ ...each })));
  const [problem, setProblem] = useState('');

  const handleRow = useCallback(
    (index: number, row: Row) => setRows(list => list.map((each, at) => (at === index ? row : each))),
    []
  );
  const handleRemove = useCallback((index: number) => setRows(list => list.filter((_, at) => at !== index)), []);
  const handleMove = useCallback((index: number, by: number) => setRows(list => moved(list, index, by)), []);
  const handleAdd = useCallback(
    () => setRows(list => [...list, emptyOf('visible', UNIT_KINDS.visible, element)]),
    [element]
  );

  const handleSave = useCallback(async () => {
    let given: UnitTest['given'];
    try {
      given = {
        state: JSON.parse(state || '{}') as Record<string, unknown>,
        sources: JSON.parse(sources || '{}') as Record<string, unknown>
      };
    } catch {
      setProblem('The state and the sources are JSON objects: {"plan": "app"}');

      return;
    }

    const refused = await onSave({ ...test, title, element, given, expect: rows.map(expectationOf) });
    if (refused !== undefined) {
      setProblem(refused);

      return;
    }

    onBack();
  }, [element, onBack, onSave, rows, sources, state, test, title]);

  return (
    <ViewPage
      onBack={onBack}
      backLabel="Tests"
      title={title || 'Unit test'}
      description="One element, resolved with no browser for the state you give it: what must hold of it then."
      actions={
        <>
          <Button size="sm" intent="secondary" onClick={onBack}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      {problem && <Notice tone="danger">{problem}</Notice>}
      <ViewSection title="What it tests">
        <Input
          size="sm"
          name="title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Choosing App lights its step"
        />
        <Select size="sm" name="element" label="Element" value={element} onChange={setElement}>
          {elements.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ViewSection>
      <ViewSection title="Given">
        <TextArea size="sm" name="state" label="State (JSON)" value={state} onChange={setState} />
        <TextArea
          size="sm"
          name="sources"
          label="Sources (JSON, by name — a list's row is list_<id>: { item, index })"
          value={sources}
          onChange={setSources}
        />
      </ViewSection>
      <ViewSection
        title="Then"
        actions={
          <Button size="sm" intent="secondary" onClick={handleAdd}>
            Add expectation
          </Button>
        }
      >
        {rows.map((row, index) => (
          <KindRow
            key={`${String(index)}-${row.kind}`}
            index={index}
            count={rows.length}
            row={row}
            kinds={UNIT_KINDS}
            elements={elements}
            elementId={element}
            onChange={handleRow}
            onRemove={handleRemove}
            onMove={handleMove}
          />
        ))}
      </ViewSection>
    </ViewPage>
  );
};

export default UnitTestForm;
