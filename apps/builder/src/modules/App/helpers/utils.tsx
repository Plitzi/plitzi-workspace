import StateManagerIcon from '@plitzi/plitzi-ui/icons/StateManager';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';

import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import Collections from '@pmodules/Collection/Collections';
import Elements from '@pmodules/Elements';
import OpenAIChat from '@pmodules/OpenAI/OpenAIChat';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';
import StateManager from '@pmodules/StateManager/StateManager';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
import Variables from '@pmodules/Variables';

import { featureFlag } from '../../../config';
import AppDirectory from '../components/AppDirectory';

import type { PopupInstance } from '@plitzi/plitzi-ui/components';

export const getPopups = ({
  sourceId,
  activeIds = [],
  handleSourceChange
}: {
  sourceId?: string;
  activeIds?: string[];
  handleSourceChange: (id?: string) => void;
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
      placementSettings: { left: { position: 0 } },
      settings: {
        icon: 'fa-solid fa-plus',
        title: 'Add Element',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'pages',
      component: <AppDirectory />,
      active: activeIds.includes('pages'),
      placementSettings: { left: { position: 1 } },
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
      placementSettings: { left: { position: 4 } },
      settings: {
        icon: (
          <Sidebar.Icon className="p-1" intent="tertiary" title="Variables">
            <Variable />
          </Sidebar.Icon>
        ),
        title: 'Space Variables',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: true,
        allowClose: false,
        placement: 'right',
        resizeHandles: ['se']
      }
    },
    {
      id: 'assets',
      component: <Resources />,
      active: activeIds.includes('assets'),
      placementSettings: { left: { position: 5 } },
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
      component: <Collections collectionId={sourceId} onSourceChange={handleSourceChange} />,
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
      placementSettings: { left: { position: 7 } },
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
      placementSettings: { left: { position: 8 } },
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
      placementSettings: { left: { position: 9 } },
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
      placementSettings: { left: { position: 10 } },
      settings: {
        icon: (
          <Sidebar.Icon className="p-2" intent="tertiary" title="State Manager">
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
      component: <OpenAIChat />,
      active: activeIds.includes('assistant'),
      settings: {
        icon: <Sidebar.Icon className="p-1" icon="fa-solid fa-star" intent="tertiary" title="Variables" />,
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
