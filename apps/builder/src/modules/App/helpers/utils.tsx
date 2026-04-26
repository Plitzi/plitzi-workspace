import StateManagerIcon from '@plitzi/plitzi-ui/icons/StateManager';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';

import StyleAdvanceEditor from '@plitzi/sdk-style/StyleAdvanceEditor';
import { AiChatPreview } from '@pmodules/AI';
import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import Collections from '@pmodules/Collection/Collections';
import Elements from '@pmodules/Elements';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';
import StateManager from '@pmodules/StateManager/StateManager';
import Variables from '@pmodules/Variables';

import { featureFlag } from '../../../config';
import AppDirectory from '../components/AppDirectory';

import type { PopupInstance } from '@plitzi/plitzi-ui/components';

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
    {
      id: 'elements',
      component: <Elements />,
      active: activeIds.includes('elements'),
      placementSettings: { left: { position: 0, minSize: 200 } },
      settings: {
        icon: 'fa-solid fa-plus',
        title: 'Elements',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'pages',
      component: <AppDirectory />,
      active: activeIds.includes('pages'),
      placementSettings: { left: { position: 1, minSize: 200 } },
      settings: {
        icon: 'fas fa-file',
        title: 'Pages',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'sitemap',
      component: undefined,
      active: activeIds.includes('sitemap'),
      placementSettings: { left: { position: 3, multi: false } },
      settings: {
        icon: 'fa-solid fa-sitemap',
        title: 'Sitemap',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'variables',
      component: <Variables />,
      active: activeIds.includes('variables'),
      placementSettings: { left: { position: 4, minSize: 200 } },
      settings: {
        icon: (
          <Sidebar.Icon className="p-1" title="Variables">
            <Variable />
          </Sidebar.Icon>
        ),
        title: 'Variables',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'assets',
      component: <Resources />,
      active: activeIds.includes('assets'),
      placementSettings: { left: { position: 5, minSize: 200 } },
      settings: {
        icon: 'fa-solid fa-image',
        title: 'Resources',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'collections',
      component: <Collections />,
      active: activeIds.includes('collections'),
      placementSettings: { left: { position: 6, multi: false } },
      settings: {
        icon: 'fas fa-database',
        title: 'Collections',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'segments',
      component: <Segments />,
      active: activeIds.includes('segments'),
      placementSettings: { left: { position: 7, minSize: 200 } },
      settings: {
        icon: 'fa-solid fa-diamond',
        title: 'Segments',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'layerManager',
      component: <BuilderTree />,
      active: activeIds.includes('layerManager'),
      placementSettings: { left: { position: 8, minSize: 200 } },
      settings: {
        icon: 'fa-solid fa-layer-group',
        title: 'Layers',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'advanceStyle',
      component: <StyleAdvanceEditor />,
      size: 'custom',
      active: activeIds.includes('advanceStyle'),
      placementSettings: { left: { position: 9, minSize: 200 } },
      settings: {
        icon: 'fa-solid fa-file-code text-base',
        title: 'Advance Style',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'stateManager',
      size: 'custom',
      component: <StateManager />,
      active: activeIds.includes('stateManager'),
      placementSettings: { left: { position: 10, minSize: 200 } },
      settings: {
        icon: (
          <Sidebar.Icon className="p-2" title="State Manager">
            <StateManagerIcon />
          </Sidebar.Icon>
        ),
        title: 'State Manager',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'settings',
      component: undefined,
      active: activeIds.includes('settings'),
      placementSettings: { left: { position: 11, multi: false } },
      settings: {
        icon: 'fas fa-cog',
        title: 'Settings',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    }
  ];

  if (featureFlag.assistanceAI) {
    left.push({
      id: 'assistant',
      component: <AiChatPreview />,
      active: activeIds.includes('assistant'),
      settings: {
        icon: <Sidebar.Icon className="p-1" icon="fa-solid fa-star" title="Variables" />,
        title: 'Assistant',
        width: 400,
        allowLeftSide: true,
        allowRightSide: true,
        allowFloatingSide: true,
        allowClose: false,
        resizeHandles: ['se']
      }
    });
  }

  return { left, right: [], floating: [] };
};
