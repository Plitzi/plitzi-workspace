import Channels from '@pmodules/Channels';
import Visitors from '@pmodules/Visitors';

import GeneralSettings from './GeneralSettings';
import PanelSections from '../../components/PanelSections';

import type { PanelSection } from '../../components/PanelSections';

const SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'general', label: 'General', content: <GeneralSettings /> },
  { id: 'visitors', label: 'Visitors', content: <Visitors /> },
  { id: 'realtime', label: 'Realtime', content: <Channels /> }
];

/** The space's settings, who may visit it — the roles it declares and who holds them — and its realtime channels. */
const ContainerSettings = () => (
  <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-900">
    <PanelSections name="settings" sections={SECTIONS} variant="page" />
  </div>
);

export default ContainerSettings;
