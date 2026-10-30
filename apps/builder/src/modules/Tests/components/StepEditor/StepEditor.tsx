import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useState } from 'react';

import { emptyOf, STEP_KINDS, stepKindOf, stepOf } from '../../helpers';
import FieldInput from '../KindRow/components/FieldInput';

import type { Row } from '../../helpers';
import type { E2eStep } from '@plitzi/sdk-shared';

export type StepEditorProps = {
  index: number;
  step: E2eStep;
  elements: { value: string; label: string }[];
  /** The element a step of a kind that names one starts on. */
  elementId: string;
  onDone: (index: number, step: E2eStep) => void;
  onRemove: (index: number) => void;
};

/** One step of the test, opened in place to be changed: what it does, and the fields that takes. */
const StepEditor = ({ index, step, elements, elementId, onDone, onRemove }: StepEditorProps) => {
  // An E2eStep is a row of its kind: a kind, and the fields that kind takes.
  const [row, setRow] = useState<Row>({ ...step });
  const spec = stepKindOf(row.kind);

  const handleKind = useCallback(
    (kind: string) =>
      setRow(current => {
        const named = typeof current.element === 'string' ? current.element : elementId;

        const taken = stepKindOf(kind);

        return taken ? { ...emptyOf(kind, taken, named), kind } : current;
      }),
    [elementId]
  );
  const handleField = useCallback(
    (name: string, value: unknown) => setRow(current => ({ ...current, [name]: value })),
    []
  );
  const handleDone = useCallback(() => onDone(index, stepOf(row)), [index, onDone, row]);
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <li className="border-primary-ui flex flex-col gap-2 rounded-md border px-2.5 py-2">
      <Select size="sm" name="kind" label={`Step ${String(index + 1)}`} value={row.kind} onChange={handleKind}>
        {Object.entries(STEP_KINDS).map(([kind, each]) => (
          <option key={kind} value={kind}>
            {each.label}
          </option>
        ))}
      </Select>
      {spec?.fields.map(field => (
        <FieldInput key={field.name} field={field} value={row[field.name]} elements={elements} onChange={handleField} />
      ))}
      <div className="flex justify-between gap-2">
        <Button size="sm" intent="danger" onClick={handleRemove}>
          Remove
        </Button>
        <Button size="sm" onClick={handleDone}>
          Done
        </Button>
      </div>
    </li>
  );
};

export default StepEditor;
