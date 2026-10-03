import { use, useCallback } from 'react';

import QaSwitch from './QaSwitch';
import QaContext from '../../../../qa/QaContext';

import type { QaSettings } from '../../../../qa/qaSettings';

type BooleanSetting = 'grid' | 'outlines' | 'viewport' | 'paused' | 'reducedMotion';

export type QaSettingSwitchProps = {
  setting: BooleanSetting;
  label: string;
  description: string;
};

/** A tool that is simply on or off. */
const QaSettingSwitch = ({ setting, label, description }: QaSettingSwitchProps) => {
  const { settings, setSetting } = use(QaContext);
  const on: QaSettings[BooleanSetting] = settings[setting];

  const handleToggle = useCallback(() => setSetting(setting, !on), [setSetting, setting, on]);

  return <QaSwitch label={label} description={description} on={on} onToggle={handleToggle} />;
};

export default QaSettingSwitch;
