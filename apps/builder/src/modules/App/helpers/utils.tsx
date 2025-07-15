import StateManagerIcon from '@plitzi/plitzi-ui/icons/StateManager';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';

import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import Collections from '@pmodules/Collection/Collections';
import Elements from '@pmodules/Elements';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';
import StateManager from '@pmodules/StateManager/StateManager';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
import Templates from '@pmodules/Templates';
import Variables from '@pmodules/Variables';

import { featureFlag } from '../../../config';
import AppDirectory from '../components/AppDirectory';

import type { PopupInstance } from '@plitzi/plitzi-ui/components';

export const getPopups = ({
  sourceId,
  handleSourceChange
}: {
  sourceId: string;
  handleSourceChange: (id: string) => void;
}): {
  left: PopupInstance[];
  right: PopupInstance[];
  floating: PopupInstance[];
} => {
  const left: PopupInstance[] = [
    {
      id: 'elements',
      component: <Elements />,
      active: false,
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
      active: false,
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
    }
  ];

  if (featureFlag.variables) {
    left.push({
      id: 'variables',
      component: <Variables />,
      active: false,
      settings: {
        icon: (
          <Sidebar.Icon className="p-1" intent="tertiary" title="Variables">
            <Variable />
          </Sidebar.Icon>
        ),
        title: 'Variables',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    });
  }

  left.push(
    {
      id: 'assets',
      component: <Resources />,
      active: false,
      settings: {
        icon: 'fa-solid fa-image',
        title: 'Resources',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'collections',
      component: <Collections collectionId={sourceId} onSourceChange={handleSourceChange} />,
      active: false,
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
      active: false,
      settings: {
        icon: 'fa-solid fa-diamond',
        title: 'Segments',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'templates',
      component: <Templates />,
      active: false,
      settings: {
        icon: 'fa-solid fa-clone',
        title: 'Templates',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'layerManager',
      component: <BuilderTree />,
      active: false,
      settings: {
        icon: 'fa-solid fa-layer-group',
        title: 'Layers',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'advanceStyle',
      component: <StyleAdvanceEditor />,
      size: 'custom',
      active: false,
      settings: {
        icon: 'fa-solid fa-file-code text-base',
        title: 'Advance Style',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'stateManager',
      size: 'custom',
      component: <StateManager />,
      active: false,
      settings: {
        icon: (
          <Sidebar.Icon className="p-2" intent="tertiary" title="Variables">
            <StateManagerIcon />
          </Sidebar.Icon>
        ),
        title: 'State Manager',
        width: 350,
        allowLeftSide: true,
        allowRightSide: false,
        allowFloatingSide: false,
        allowClose: false,
        resizeHandles: ['se']
      }
    },
    {
      id: 'settings',
      component: undefined,
      active: false,
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
  );

  return { left, right: [], floating: [] };
};
