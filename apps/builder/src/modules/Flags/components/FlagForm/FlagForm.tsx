import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useFieldArray, useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import { isFlagName } from '@plitzi/sdk-shared/flags';

import FlagRule from './FlagRule';
import { EMPTY_WHEN, isRuleGroup } from './ruleGroup';

import type { Field, RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { SchemaFlag } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const flagFormSchema = z.object({
  name: z.string().refine(isFlagName, {
    message: 'Letters, numbers and _ only, starting with a letter or _ — it is read as {{ flags.<name> }}'
  }),
  description: z.string().max(300),
  value: z.boolean(),
  rules: z.array(
    z.object({ value: z.boolean(), when: z.custom<RuleGroup>(isRuleGroup, { message: 'A rule needs its conditions' }) })
  )
});

type FlagFormValues = z.infer<typeof flagFormSchema>;

export type FlagFormProps = {
  name?: string;
  flag?: SchemaFlag;
  isNewRecord?: boolean;
  /** The names already declared, so a new flag cannot take one. */
  takenNames?: string[];
  fields: Record<string, Field>;
  onSubmit: (name: string, flag: SchemaFlag) => void;
  onClose: (e?: MouseEvent) => void;
};

const FlagForm = ({
  name = '',
  flag = { value: false, rules: [] },
  isNewRecord = false,
  takenNames = [],
  fields,
  onSubmit,
  onClose
}: FlagFormProps) => {
  const form = useForm({
    defaultValues: { name, description: flag.description ?? '', value: flag.value, rules: flag.rules },
    config: {
      schema: flagFormSchema.refine(values => !isNewRecord || !takenNames.includes(values.name), {
        message: 'A flag with this name already exists',
        path: ['name']
      })
    }
  });
  const { fields: rules, append, remove, move } = useFieldArray({ control: form.formMethods.control, name: 'rules' });

  const handleSubmit = useCallback(
    ({ name: flagName, description, value, rules: flagRules }: FlagFormValues) =>
      onSubmit(flagName, { ...(description ? { description } : {}), value, rules: flagRules }),
    [onSubmit]
  );

  const handleAddRule = useCallback(() => append({ value: true, when: EMPTY_WHEN }), [append]);

  const handleMove = useCallback(
    (from: number, to: number) => {
      if (to >= 0 && to < rules.length) {
        move(from, to);
      }
    },
    [move, rules.length]
  );

  return (
    <Form form={form} onSubmit={handleSubmit} className="gap-4 rounded border border-gray-300 p-2 dark:border-zinc-700">
      <Form.Body gap={2}>
        <Form.Input name="name" label="Name" size="xs" disabled={!isNewRecord} />
        <Form.Input name="description" label="Description" placeholder="What it turns on" size="xs" />
        <Form.Switch name="value" label="On when no rule matches" size="xs" />
        {rules.length > 0 && (
          <Alert intent="info" size="xs">
            Rules are read top to bottom: the first one that matches decides
          </Alert>
        )}
        {rules.map((rule, index) => (
          <FlagRule
            key={rule.id}
            index={index}
            last={index === rules.length - 1}
            fields={fields}
            onRemove={remove}
            onMove={handleMove}
          />
        ))}
        <Button size="xs" onClick={handleAddRule}>
          + Rule
        </Button>
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="xs">
          Cancel
        </Button>
        <Button type="submit" size="xs">
          {isNewRecord ? 'Add' : 'Update'}
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default FlagForm;
