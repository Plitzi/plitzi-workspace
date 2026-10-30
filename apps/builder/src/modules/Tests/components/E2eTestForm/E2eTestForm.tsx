import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useState } from 'react';

import ViewPage from '@pmodules/App/components/ViewPage';
import ViewSection from '@pmodules/App/components/ViewSection';

import { STEP_KINDS, WIDTHS, emptyOf, moved, stepOf } from '../../helpers';
import TestsRecordingContext from '../../recording/TestsRecordingContext';
import KindRow from '../KindRow';

import type { Row } from '../../helpers';
import type { E2eTest } from '@plitzi/sdk-shared';

export type E2eTestFormProps = {
  test: E2eTest;
  elements: { value: string; label: string }[];
  /** The space's pages, by the path each answers. */
  pages: string[];
  /** The element a new step starts on: the one selected in the canvas. */
  elementId: string;
  /** Saves it; answers why it could not be, or nothing once it is. */
  onSave: (test: E2eTest) => Promise<string | undefined>;
  onBack: () => void;
};

/** An e2e test written: the page it opens, at what width, and the visitor's steps with what must hold between them. */
const E2eTestForm = ({ test, elements, pages, elementId, onSave, onBack }: E2eTestFormProps) => {
  const [title, setTitle] = useState(test.title);
  const [page, setPage] = useState(test.page);
  const [width, setWidth] = useState(String(test.width ?? 1440));
  const [rows, setRows] = useState<Row[]>(test.steps.map(each => ({ ...each })));
  const [problem, setProblem] = useState('');

  const handleRow = useCallback(
    (index: number, row: Row) => setRows(list => list.map((each, at) => (at === index ? row : each))),
    []
  );
  const handleRemove = useCallback((index: number) => setRows(list => list.filter((_, at) => at !== index)), []);
  const handleMove = useCallback((index: number, by: number) => setRows(list => moved(list, index, by)), []);
  const handleAddStep = useCallback(
    () => setRows(list => [...list, emptyOf('click', STEP_KINDS.click, elementId)]),
    [elementId]
  );
  const handleAddCheck = useCallback(
    () => setRows(list => [...list, emptyOf('expectShown', STEP_KINDS.expectShown, elementId)]),
    [elementId]
  );

  const { start } = use(TestsRecordingContext);
  const handleRecord = useCallback(
    () => start({ test: { ...test, title, page, width: Number(width), steps: [] }, rows }),
    [page, rows, start, test, title, width]
  );

  const handleSave = useCallback(async () => {
    const refused = await onSave({ ...test, title, page, width: Number(width), steps: rows.map(stepOf) });
    if (refused !== undefined) {
      setProblem(refused);

      return;
    }

    onBack();
  }, [onBack, onSave, page, rows, test, title, width]);

  return (
    <ViewPage
      onBack={onBack}
      backLabel="Tests"
      title={title || 'E2E test'}
      description="A page opened as a visitor would: what they do, and what the page must show as they go."
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
      {problem && (
        <Alert intent="error" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
      <ViewSection title="What it tests">
        <Input
          size="sm"
          name="title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="A visitor adds a coffee"
        />
        <div className="flex gap-2">
          <Select size="sm" name="page" label="Page" value={page} onChange={setPage}>
            {pages.map(path => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </Select>
          <Select size="sm" name="width" label="Width" value={width} onChange={setWidth}>
            {WIDTHS.map(option => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </ViewSection>
      <ViewSection
        title="Steps"
        actions={
          <div className="flex gap-2">
            <Button size="sm" intent="secondary" onClick={handleRecord}>
              <i className="fa-solid fa-circle text-[8px] text-red-500" /> Record steps
            </Button>
            <Button size="sm" intent="secondary" onClick={handleAddStep}>
              Add step
            </Button>
            <Button size="sm" intent="secondary" onClick={handleAddCheck}>
              Add expectation
            </Button>
          </div>
        }
      >
        {rows.map((row, index) => (
          <KindRow
            key={`${String(index)}-${row.kind}`}
            index={index}
            count={rows.length}
            row={row}
            kinds={STEP_KINDS}
            elements={elements}
            elementId={elementId}
            onChange={handleRow}
            onRemove={handleRemove}
            onMove={handleMove}
          />
        ))}
      </ViewSection>
    </ViewPage>
  );
};

export default E2eTestForm;
