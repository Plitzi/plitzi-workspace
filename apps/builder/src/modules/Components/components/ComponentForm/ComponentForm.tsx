import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo, useState } from 'react';

import { propNameProblem } from '@plitzi/sdk-schema/helpers/components';

import PropsEditor from '../PropsEditor';
import { componentFormSchema, entriesOf } from './helpers';
import SlotChoice from './SlotChoice';
import FormSection from '../FormSection';

import type { PropEntry } from '../PropsEditor';
import type { PageFolder, SpaceComponentDeclaration } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';
import type { z } from 'zod';

export type ComponentFormProps = {
  declaration?: SpaceComponentDeclaration;
  /** The elements of the component's tree that can be a slot: those that hold children. */
  slotChoices?: { id: string; label: string }[];
  pageFolders?: PageFolder[];
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: SpaceComponentDeclaration) => void;
};

/**
 * What a component declares: what it is called, where the builder files it, the props an instance hands in and the
 * elements of its tree an instance fills.
 */
const ComponentForm = ({ declaration, slotChoices = [], pageFolders = [], onClose, onSubmit }: ComponentFormProps) => {
  const form = useForm({
    defaultValues: { label: declaration?.label ?? 'New Component', folder: declaration?.folder ?? '' },
    config: { schema: componentFormSchema }
  });
  const [entries, setEntries] = useState<PropEntry[]>(() => entriesOf(declaration));
  const [slots, setSlots] = useState<string[]>(() => declaration?.slots ?? []);

  const invalid = useMemo(
    () =>
      entries.some(
        (entry, index) => propNameProblem(entry.name) || entries.findIndex(e => e.name === entry.name) !== index
      ),
    [entries]
  );

  const handleToggleSlot = useCallback(
    (id: string, checked: boolean) =>
      setSlots(current => (checked ? [...current, id] : current.filter(slot => slot !== id))),
    []
  );

  const handleSubmitInternal = useCallback(
    ({ label, folder }: z.infer<typeof componentFormSchema>) => {
      if (invalid) {
        return;
      }

      onSubmit?.(undefined, {
        label,
        ...(folder ? { folder } : {}),
        props: Object.fromEntries(entries.map(({ name, prop }) => [name, prop])),
        slots
      });
    },
    [invalid, entries, slots, onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal}>
      {/* A component with many props is taller than the screen: the fields scroll, never the buttons below them. */}
      <Form.Body className="max-h-[calc(100dvh-14rem)] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <Form.Input name="label" label="Component Name" size="xs" />
          <Form.Select name="folder" label="Folder" placeholder="None" size="xs">
            {pageFolders.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Form.Select>
        </div>
        <PropsEditor value={entries} onChange={setEntries} />
        {slotChoices.length > 0 && (
          <FormSection title="Slots" hint="Where an instance’s own children go — none, and it takes no children.">
            <Flex direction="column" gap={1.5}>
              {slotChoices.map(choice => (
                <SlotChoice
                  key={choice.id}
                  id={choice.id}
                  label={choice.label}
                  checked={slots.includes(choice.id)}
                  onToggle={handleToggleSlot}
                />
              ))}
            </Flex>
          </FormSection>
        )}
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="xs" intent="secondary">
          Cancel
        </Button>
        <Button type="submit" size="xs" disabled={invalid}>
          Submit
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default ComponentForm;
