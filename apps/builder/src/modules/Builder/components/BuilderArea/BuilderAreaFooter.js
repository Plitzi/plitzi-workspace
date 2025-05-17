// Packages
import React, { useCallback, use } from 'react';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

// Alias
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
import StateManager from '@pmodules/StateManager/StateManager';
import OpenAIChat from '@pmodules/OpenAI/OpenAIChat';
import Transform from '@pmodules/Transformers/Transform';

// Relatives
import BuilderElementTools from '../BuilderElementTools';
import BuilderTree from '../BuilderTree';
import { BUILDER_MODE_NORMAL } from '../../BuilderProvider';
import { featureFlag } from '../../../../config';

/**
 * @param {{
 *   setDragTree?: (dragTree: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderAreaFooter = props => {
  const { setDragTree = noop } = props;
  const { existsPopup, addPopup } = usePopup();
  const { mode } = use(BuilderContext);

  const handleClickTools = useCallback(() => {
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right'
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickLayerManayer = useCallback(() => {
    if (!existsPopup('layerManager')) {
      addPopup('layerManager', <BuilderTree setDragTree={setDragTree} />, {
        icon: <i className="fas fa-stream text-base" />,
        title: 'Layer Manager',
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right',
        resizeHandles: ['se']
      });
    }
  }, [setDragTree, addPopup, existsPopup, mode]);

  const handleClickAdvanceStyle = useCallback(() => {
    if (!existsPopup('advanceStyle')) {
      addPopup('advanceStyle', <StyleAdvanceEditor />, {
        icon: <i className="fas fa-code text-base" />,
        title: 'Advance Style',
        resizeHandles: ['se'],
        height: 400,
        width: 600,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right'
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickStateManager = useCallback(() => {
    if (!existsPopup('stateManager')) {
      addPopup('stateManager', <StateManager />, {
        icon: <i className="fa-solid fa-sliders text-base" />,
        title: 'State Manager',
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickTransform = useCallback(() => {
    if (!existsPopup('transform')) {
      addPopup('transform', <Transform />, {
        icon: <i className="fa-brands fa-nfc-symbol text-base" />,
        title: 'Import And Transform',
        height: 400,
        width: 800,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickAssistant = useCallback(() => {
    if (!existsPopup('assistant')) {
      addPopup('assistant', <OpenAIChat />, {
        icon: <i className="fa-solid fa-star text-base" />,
        title: 'Assistant',
        width: 400,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  return (
    <div className="flex justify-center items-center gap-4">
      <div className="p-1 flex items-center rounded-sm bg-white shadow">
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickTools}
          className="hover:bg-gray-200 h-9 w-9 mr-2 text-gray-500"
          title="Tools"
        >
          <i className="fas fa-tools" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickLayerManayer}
          className="hover:bg-gray-200 h-9 w-9 mr-2 text-gray-500"
          title="Layer Manager"
        >
          <i className="fas fa-stream" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickAdvanceStyle}
          className="hover:bg-gray-200 h-9 w-9 text-gray-500"
          title="Advance Style"
        >
          <i className="fas fa-code" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickStateManager}
          className="hover:bg-gray-200 h-9 w-9 text-gray-500"
          title="State Manager"
        >
          <i className="fa-solid fa-sliders" />
        </Button>
        {featureFlag.assistanceAI && (
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickAssistant}
            className="hover:bg-gray-200 h-9 w-9 text-gray-500"
            title="Assistant"
          >
            <i className="fa-solid fa-star" />
          </Button>
        )}
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickTransform}
          className="hover:bg-gray-200 h-9 w-9 text-gray-500"
          title="Transform"
        >
          <i className="fa-brands fa-nfc-symbol" />
        </Button>
      </div>
    </div>
  );
};

export default BuilderAreaFooter;
