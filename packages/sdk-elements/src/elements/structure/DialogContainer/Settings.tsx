import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  acceptButtonLabel?: string;
  acceptButtonLabelLoading?: string;
  rejectButtonLabel?: string;
  headerLabel?: string;
  autoHideAfterClick?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  acceptButtonLabel = 'Accept',
  acceptButtonLabelLoading = 'Loading...',
  rejectButtonLabel = 'Cancel',
  headerLabel = 'Dialog Header',
  autoHideAfterClick = true,
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  const handleChangeAutoHide = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('autoHideAfterClick', e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Header Label" value={headerLabel} onChange={update.text('headerLabel')} size="xs" />
      <Input
        label="Accept Label Button"
        value={acceptButtonLabel}
        onChange={update.text('acceptButtonLabel')}
        size="xs"
      />
      <Input
        label="Reject Label Button"
        value={rejectButtonLabel}
        onChange={update.text('rejectButtonLabel')}
        size="xs"
      />
      <Input
        label="Accept Label Button Loading"
        value={acceptButtonLabelLoading}
        onChange={update.text('acceptButtonLabelLoading')}
        size="xs"
      />
      <Checkbox
        label="Hide after click background"
        checked={autoHideAfterClick}
        onChange={handleChangeAutoHide}
        size="xs"
      />
    </div>
  );
};

export default Settings;
