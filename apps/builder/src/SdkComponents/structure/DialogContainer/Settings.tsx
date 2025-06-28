import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

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
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeAutoHide = useCallback(
    (e: ChangeEvent) => onUpdate?.('autoHideAfterClick', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Header Label" value={headerLabel} onChange={handleChange('headerLabel')} />
      <Input label="Accept Label Button" value={acceptButtonLabel} onChange={handleChange('acceptButtonLabel')} />
      <Input label="Reject Label Button" value={rejectButtonLabel} onChange={handleChange('rejectButtonLabel')} />
      <Input
        label="Accept Label Button Loading"
        value={acceptButtonLabelLoading}
        onChange={handleChange('acceptButtonLabelLoading')}
      />
      <Checkbox label="Hide after click background" checked={autoHideAfterClick} onChange={handleChangeAutoHide} />
    </div>
  );
};

export default Settings;
