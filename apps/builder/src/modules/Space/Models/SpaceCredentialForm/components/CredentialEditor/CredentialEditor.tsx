import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';

import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import { initialValues, spaceCredentialFormSchema } from '../../helpers';
import CredentialFields from '../CredentialFields';
import NamedValues from '../NamedValues';
import ObtainGuide from '../ObtainGuide';
import ProviderSummary from '../ProviderSummary';

import type { SpaceCredentialFormValues } from '../../helpers';
import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type CredentialEditorProps = {
  provider: SpaceCredentialProvider;
  name?: string;
  editing: boolean;
  onChangeProvider?: () => void;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: SpaceCredentialFormValues) => void;
};

/**
 * One kind's credential filled in: what it is at the top, its fields — named by the provider's own words, a secret
 * typed unseen — and where the provider issues one beside them.
 */
const CredentialEditor = ({ provider, name, editing, onChangeProvider, onClose, onSubmit }: CredentialEditorProps) => {
  const form = useForm({ defaultValues: initialValues(provider, name), config: { schema: spaceCredentialFormSchema } });
  const open = CREDENTIAL_KINDS[provider].fields.length === 0;

  const handleSubmit = useCallback((values: SpaceCredentialFormValues) => onSubmit?.(undefined, values), [onSubmit]);

  return (
    <Form form={form} onSubmit={handleSubmit} className="@container max-w-5xl gap-4">
      <Form.Body>
        <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_20rem] @3xl:items-start">
          <div className="flex flex-col gap-4">
            <ProviderSummary provider={provider} onChange={onChangeProvider} />
            {editing && (
              <span className="text-ui-fg-subtle text-xs">
                Its values are never shown back. Enter them all again: saving replaces every one.
              </span>
            )}
            <Form.Input name="name" label="Name" size="xs" placeholder="What you will know it by" />
            {open && <NamedValues />}
            {!open && <CredentialFields provider={provider} />}
          </div>
          <ObtainGuide provider={provider} />
        </div>
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm" intent="secondary">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          {editing ? 'Save' : 'Add credential'}
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default CredentialEditor;
