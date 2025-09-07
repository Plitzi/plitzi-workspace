import Button from '@plitzi/plitzi-ui/Button';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, use } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import OpenAIChat from '@pmodules/OpenAI/OpenAIChat';
import StateManager from '@pmodules/StateManager/StateManager';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
import Transform from '@pmodules/Transformers/Transform';

import { featureFlag } from '../../../../config';
import BuilderElementTools from '../BuilderElementTools';
import BuilderTree from '../BuilderTree';

export type BuilderAreaFooterProps = {
  setDragTree?: (dragTree: boolean) => void;
};

const BuilderAreaFooter = ({ setDragTree }: BuilderAreaFooterProps) => {
  const { existsPopup, addPopup } = usePopup();
  const { mode } = use(BuilderContext);

  const handleClickTools = useCallback(() => {
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right'
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickLayerManayer = useCallback(() => {
    if (!existsPopup('layerManager')) {
      addPopup('layerManager', <BuilderTree setDragTree={setDragTree} />, {
        icon: <i className="fas fa-stream text-base" />,
        title: 'Layer Manager',
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right',
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
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right'
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickStateManager = useCallback(() => {
    if (!existsPopup('stateManager')) {
      addPopup('stateManager', <StateManager />, {
        icon: <i className="fa-solid fa-sliders text-base" />,
        title: 'State Manager',
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right',
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
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right',
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
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex items-center rounded-sm bg-white p-1 shadow">
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickTools}
          className="mr-2 h-9 w-9 text-gray-500 hover:bg-gray-200"
          title="Tools"
        >
          <Button.Icon icon="fas fa-tools" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickLayerManayer}
          className="mr-2 h-9 w-9 text-gray-500 hover:bg-gray-200"
          title="Layer Manager"
        >
          <Button.Icon icon="fas fa-stream" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickAdvanceStyle}
          className="h-9 w-9 text-gray-500 hover:bg-gray-200"
          title="Advance Style"
        >
          <Button.Icon icon="fas fa-code" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickStateManager}
          className="h-9 w-9 text-gray-500 hover:bg-gray-200"
          title="State Manager"
        >
          <Button.Icon icon="fa-solid fa-sliders" />
        </Button>
        {featureFlag.assistanceAI && (
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickAssistant}
            className="h-9 w-9 text-gray-500 hover:bg-gray-200"
            title="Assistant"
          >
            <Button.Icon icon="fa-solid fa-star" />
          </Button>
        )}
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickTransform}
          className="h-9 w-9 text-gray-500 hover:bg-gray-200"
          title="Transform"
        >
          <i className="fa-brands fa-nfc-symbol" />
        </Button>
      </div>
    </div>
  );
};

export default BuilderAreaFooter;
