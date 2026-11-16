import Form from '@plitzi/plitzi-ui/Form';
import { useCallback, useState } from 'react';

import type { CredentialField as Field } from '@plitzi/sdk-shared/credentials';

export type CredentialFieldProps = {
  field: Field;
};

/**
 * One field of a credential as its kind declares it: a choice as a select, a secret typed unseen until asked to show
 * it — to check a pasted value — and what to write said under it.
 */
const CredentialField = ({ field }: CredentialFieldProps) => {
  const [shown, setShown] = useState(false);
  const label = field.required ? field.label : `${field.label} (optional)`;

  const handleToggle = useCallback(() => setShown(value => !value), []);

  if (field.choices) {
    return (
      <Form.Select name={`data.${field.key}`} label={label} size="xs">
        {field.choices.map(choice => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </Form.Select>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Form.Input
        name={`data.${field.key}`}
        label={label}
        placeholder={field.example}
        size="xs"
        autoComplete={field.secret ? 'new-password' : 'off'}
        spellCheck={false}
        type={field.secret && !shown ? 'password' : 'text'}
      >
        {field.secret && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={shown ? `Hide ${field.label}` : `Show ${field.label}`}
            className="text-ui-fg-subtle hover:text-ui-fg order-last shrink-0 px-2 text-xs"
          >
            <i className={shown ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden />
          </button>
        )}
      </Form.Input>
      {field.hint && <span className="text-ui-fg-subtle text-xs">{field.hint}</span>}
    </div>
  );
};

export default CredentialField;
