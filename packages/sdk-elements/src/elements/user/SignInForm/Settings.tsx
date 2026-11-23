import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  usernameLabel?: string;
  passwordLabel?: string;
  codeLabel?: string;
  submitLabel?: string;
  redirectTo?: string;
  wrongMessage?: string;
  unverifiedMessage?: string;
  blockedMessage?: string;
  ssoMessage?: string;
  networkMessage?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** What each refusal says, in the panel's order: the visitor's mistake first, then the account's state, then the network. */
const MESSAGES = [
  ['wrongMessage', 'Wrong email or password'],
  ['unverifiedMessage', 'Email not confirmed'],
  ['blockedMessage', 'Account blocked'],
  ['ssoMessage', 'Single sign-on required'],
  ['networkMessage', 'Could not be reached']
] as const;

/** A sign-in form's settings: its words, where a visitor goes once signed in, and what each refusal says. */
const Settings = (props: SettingsProps) => {
  const {
    usernameLabel = 'Email',
    passwordLabel = 'Password',
    codeLabel = 'Code',
    submitLabel = 'Sign in',
    redirectTo = '',
    onUpdate
  } = props;
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Email label" size="xs" value={usernameLabel} onChange={update.text('usernameLabel')} />
      <Input label="Password label" size="xs" value={passwordLabel} onChange={update.text('passwordLabel')} />
      <Input label="Code label" size="xs" value={codeLabel} onChange={update.text('codeLabel')} />
      <Input label="Button" size="xs" value={submitLabel} onChange={update.text('submitLabel')} />
      <Input
        label="Once signed in"
        size="xs"
        placeholder="Back where they came from"
        value={redirectTo}
        onChange={update.text('redirectTo')}
      />
      <span className="text-ui-fg-subtle text-xs">
        Empty, back to the ?redirect= of this site they were sent with, or they stay on the page.
      </span>
      {MESSAGES.map(([key, label]) => (
        <Input key={key} label={label} size="xs" value={props[key] ?? ''} onChange={update.text(key)} />
      ))}
      <span className="text-ui-fg-subtle text-xs">
        Through a provider that signs in by going out and back — Plitzi’s — it is one button; the fields are for the
        space’s own sign-in.
      </span>
    </div>
  );
};

export default Settings;
