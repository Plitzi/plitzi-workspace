import StateManagerIcon from '@plitzi/plitzi-ui/icons/StateManager';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';

import StyleAdvanceEditor from '@plitzi/sdk-style/StyleAdvanceEditor';
import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import Elements from '@pmodules/Elements';
import Flags from '@pmodules/Flags';
import Fonts from '@pmodules/Fonts';
import Resources from '@pmodules/Resources';
import StateManager from '@pmodules/StateManager/StateManager';
import Variables from '@pmodules/Variables';

import AppDirectory from '../components/AppDirectory';
import PanelSections from '../components/PanelSections';

import type { PanelSection } from '../components/PanelSections';
import type { PopupInstance, PopupSettings } from '@plitzi/plitzi-ui/components';
import type { ReactNode } from 'react';

/**
 * The entries of the sidebar that REPLACE the canvas instead of opening beside it. `AppContainer` draws them; here they
 * are only an icon, and alone on the side while open.
 */
export const FULL_VIEW_IDS = ['server', 'settings'] as const;

export type FullViewId = (typeof FULL_VIEW_IDS)[number];

export const isFullViewId = (id: string | undefined): id is FullViewId =>
  FULL_VIEW_IDS.some(fullViewId => fullViewId === id);

type PanelOptions = {
  icon: PopupSettings['icon'];
  title: string;
  component: ReactNode;
  width?: number;
  size?: PopupInstance['size'];
  allowFloatingSide?: boolean;
};

const panel = (id: string, position: number, activeIds: string[], options: PanelOptions): PopupInstance => {
  const { icon, title, component, width = 350, size, allowFloatingSide = true } = options;

  return {
    id,
    component,
    active: activeIds.includes(id),
    placementSettings: { left: { position, minSize: 200 } },
    ...(size ? { size } : {}),
    settings: {
      icon,
      title,
      width,
      allowLeftSide: true,
      allowRightSide: false,
      allowFloatingSide,
      allowClose: false,
      resizeHandles: ['se']
    }
  };
};

const fullView = (
  id: FullViewId,
  position: number,
  activeIds: string[],
  icon: string,
  title: string
): PopupInstance => ({
  id,
  component: undefined,
  active: activeIds.includes(id),
  placementSettings: { left: { position, multi: false } },
  settings: {
    icon,
    title,
    width: 350,
    allowLeftSide: true,
    allowRightSide: false,
    allowFloatingSide: false,
    allowClose: false,
    resizeHandles: ['se']
  }
});

// Values that change by environment, and the switches that do: both read by the same rules and bindings.
const DATA_SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'variables', label: 'Variables', content: <Variables /> },
  { id: 'flags', label: 'Feature Flags', content: <Flags /> }
];

const ASSET_SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'files', label: 'Files', content: <Resources /> },
  { id: 'fonts', label: 'Fonts', content: <Fonts /> }
];

export const getPopups = ({
  activeIds = []
}: {
  activeIds?: string[];
}): {
  left: PopupInstance[];
  right: PopupInstance[];
  floating: PopupInstance[];
} => {
  const left: PopupInstance[] = [
    panel('elements', 0, activeIds, { icon: 'fa-solid fa-plus', title: 'Elements', component: <Elements /> }),
    panel('pages', 1, activeIds, {
      icon: 'fas fa-file',
      title: 'Pages',
      component: <AppDirectory />,
      allowFloatingSide: false
    }),
    panel('variables', 2, activeIds, {
      icon: (
        <Sidebar.Icon className="p-1" title="Variables and Feature Flags">
          <Variable />
        </Sidebar.Icon>
      ),
      title: 'Variables',
      component: <PanelSections name="variables" sections={DATA_SECTIONS} />
    }),
    panel('assets', 3, activeIds, {
      icon: 'fa-solid fa-image',
      title: 'Assets',
      component: <PanelSections name="assets" sections={ASSET_SECTIONS} />
    }),
    panel('layerManager', 4, activeIds, {
      icon: 'fa-solid fa-layer-group',
      title: 'Layers',
      component: <BuilderTree />
    }),
    panel('advanceStyle', 5, activeIds, {
      icon: 'fa-solid fa-file-code text-base',
      title: 'Advance Style',
      component: <StyleAdvanceEditor />,
      size: 'custom'
    }),
    panel('stateManager', 6, activeIds, {
      icon: (
        <Sidebar.Icon className="p-2" title="State Manager">
          <StateManagerIcon />
        </Sidebar.Icon>
      ),
      title: 'State Manager',
      component: <StateManager />,
      size: 'custom'
    }),
    fullView('server', 7, activeIds, 'fa-solid fa-server', 'Server'),
    fullView('settings', 8, activeIds, 'fas fa-cog', 'Settings')
  ];

  return { left, right: [], floating: [] };
};
