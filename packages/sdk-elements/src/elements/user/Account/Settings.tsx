import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  signInHref?: string;
  signInLabel?: string;
  signOutLabel?: string;
  signOutHref?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** An account's settings: where a guest signs in, where a visitor goes once signed out, and the words for both. */
const Settings = ({
  signInHref = '',
  signInLabel = 'Sign in',
  signOutLabel = 'Sign out',
  signOutHref = '',
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Sign in label" size="xs" value={signInLabel} onChange={update.text('signInLabel')} />
      <Input
        label="Sign-in page"
        size="xs"
        placeholder="/sign-in"
        value={signInHref}
        onChange={update.text('signInHref')}
      />
      <span className="text-ui-fg-subtle text-xs">
        Sent there with ?redirect= back to the page they were on. Empty, the provider’s own sign-in — on Plitzi, “Sign
        in with Plitzi”.
      </span>
      <Input label="Sign out label" size="xs" value={signOutLabel} onChange={update.text('signOutLabel')} />
      <Input
        label="After signing out"
        size="xs"
        placeholder="Stay on the page"
        value={signOutHref}
        onChange={update.text('signOutHref')}
      />
      <span className="text-ui-fg-subtle text-xs">
        Its children are the menu’s entries — the profile, the settings — between the name and Sign out. While editing,
        the menu is shown open as somebody signed in sees it.
      </span>
    </div>
  );
};

export default Settings;
