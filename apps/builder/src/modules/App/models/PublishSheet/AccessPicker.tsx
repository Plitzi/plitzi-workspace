import { useCallback } from 'react';

import type { SpaceCredential } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type AccessPickerProps = {
  /** The Site password it asks for, by identifier; empty, everybody. */
  value: string;
  passwords: readonly SpaceCredential[];
  /** Said under it: when the choice takes effect. */
  hint?: string;
  /** The domain it is for, when it is not plain from where it is shown. */
  domain?: string;
  disabled?: boolean;
  onChange: (identifier: string) => void;
};

/**
 * Who may see a domain: everybody, or whoever has one of the space's Site passwords — said in words, with where to make
 * one when the space has none yet.
 */
const AccessPicker = ({ value, passwords, hint, domain, disabled = false, onChange }: AccessPickerProps) => {
  const handleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value), [onChange]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-ui-fg flex items-center gap-1.5 text-xs font-medium">
        <i className={value ? 'fa-solid fa-lock' : 'fa-solid fa-earth-americas'} aria-hidden />
        {domain ? `Who can see ${domain}` : 'Who can see it'}
      </span>
      <select
        className="border-ui-line bg-ui-panel text-ui-fg focus:border-primary-500 rounded-md border px-2 py-1.5 text-sm outline-none disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={handleChange}
      >
        <option value="">Everybody</option>
        {passwords.map(password => (
          <option key={password.identifier} value={password.identifier}>
            Only who has the password {password.name}
          </option>
        ))}
      </select>
      <span className="text-ui-fg-subtle text-xs">
        {passwords.length === 0
          ? 'To ask for a password, add a Site password in Server → Credentials.'
          : (hint ?? 'Visitors are asked for it by their browser before any page shows.')}
      </span>
    </label>
  );
};

export default AccessPicker;
