// Packages
import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import { POPUP_PLACEMENT_RIGHT, POPUP_PLACEMENT_FLOATING } from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Alias
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
import { DISPLAY_BORDER } from '@pmodules/Builder/BuilderHelper';
import AppContext from '@pmodules/App/AppContext';
import StateManager from '@pmodules/StateManager/StateManager';
// import OpenAIChat from '@pmodules/OpenAI/OpenAIChat';
import Transform from '@pmodules/Transformers/Transform';

// Relatives
import BuilderElementTools from '../BuilderElementTools';
import BuilderTree from '../BuilderTree';
import BuilderContext from '../../BuilderContext';
import { BUILDER_MODE_NORMAL } from '../../BuilderProvider';

const BuilderAreaFooter = props => {
  const { setDragTree = noop, displayMode = 'desktop' } = props;
  const { existsPopup, addPopup } = usePopup();
  const { setDisplayMode } = useContext(AppContext);
  const { mode, mobilePreview, setMobilePreview } = useContext(BuilderContext);

  const handleClickMode = displayMode => () => setDisplayMode(displayMode);

  const handleMobilePreview = useCallback(() => setMobilePreview(state => !state), [setMobilePreview]);

  const handleClickTools = useCallback(() => {
    if (!existsPopup('element-tools')) {
      const title = (
        <>
          <i className="fas fa-tools m-1 text-base" />
          Tools
        </>
      );
      addPopup('element-tools', <BuilderElementTools />, {
        resizeHandles: ['se'],
        width: 350,
        title,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickLayerManayer = useCallback(() => {
    if (!existsPopup('layerManager')) {
      const title = (
        <>
          <i className="fas fa-stream m-1 text-base" />
          Layer Manager
        </>
      );
      addPopup('layerManager', <BuilderTree setDragTree={setDragTree} />, {
        title,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT,
        resizeHandles: ['se']
      });
    }
  }, [setDragTree, addPopup, existsPopup, mode]);

  const handleClickAdvanceStyle = useCallback(() => {
    if (!existsPopup('advance-style')) {
      const title = (
        <>
          <i className="fas fa-code m-1 text-base" />
          Advance Style
        </>
      );
      addPopup('advance-style', <StyleAdvanceEditor />, {
        title,
        resizeHandles: ['se'],
        height: 400,
        width: 600,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickStateManager = useCallback(() => {
    if (!existsPopup('stateManager')) {
      const title = (
        <>
          <i className="fa-solid fa-sliders m-1 text-base" />
          State Manager
        </>
      );
      addPopup('stateManager', <StateManager />, {
        title,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT,
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickTransform = useCallback(() => {
    if (!existsPopup('transform')) {
      const title = (
        <>
          <i className="fa-brands fa-nfc-symbol m-1 text-base" />
          Import And Transform
        </>
      );
      addPopup('transform', <Transform />, {
        title,
        height: 400,
        width: 800,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT,
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup, mode]);

  // const handleClickAssistant = useCallback(() => {
  //   if (!existsPopup('assistant')) {
  //     const title = (
  //       <>
  //         <i className="fa-solid fa-star m-1 text-base" />
  //         Assistant
  //       </>
  //     );
  //     addPopup('assistant', <OpenAIChat />, {
  //       title,
  //       height: 400,
  //       width: 600,
  //       allowLeftSide: mode === BUILDER_MODE_NORMAL,
  //       allowRightSide: mode === BUILDER_MODE_NORMAL,
  //       placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT,
  //       resizeHandles: ['se']
  //     });
  //   }
  // }, [addPopup, existsPopup, mode]);

  return (
    <div className="flex justify-center items-center gap-4">
      {mode === BUILDER_MODE_NORMAL && (
        <div className="p-1 flex items-center rounded bg-white shadow">
          <Button
            intent="custom"
            size="custom"
            onClick={handleMobilePreview}
            className={classNames('relative hover:bg-gray-200 h-9 w-9 mr-2', {
              'text-gray-500': mobilePreview,
              'text-gray-300 hover:text-gray-500': !mobilePreview
            })}
            title="Mobile Preview"
          >
            <i className="fa-solid fa-desktop" />
            <i className="fa-solid fa-mobile absolute text-xs bg-white bottom-1 right-1" />
          </Button>
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickMode('desktop')}
            className={classNames('hover:bg-gray-200 h-9 w-9 mr-2', {
              'text-gray-500': displayMode === 'desktop',
              'text-gray-300 hover:text-gray-500': displayMode !== 'desktop'
            })}
            title="Mode: Desktop"
          >
            <i className="fas fa-desktop" />
          </Button>
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickMode('tablet')}
            className={classNames('hover:bg-gray-200 h-9 w-9 mr-2', {
              'text-gray-500': displayMode === 'tablet',
              'text-gray-300 hover:text-gray-500': displayMode !== 'tablet'
            })}
            title="Mode: Tablet"
          >
            <i className="fas fa-tablet-alt" />
          </Button>
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickMode('mobile')}
            className={classNames('hover:bg-gray-200 h-9 w-9', {
              'text-gray-500': displayMode === 'mobile',
              'text-gray-300 hover:text-gray-500': displayMode !== 'mobile'
            })}
            title="Mode: Mobile"
          >
            <i className="fas fa-mobile-alt" />
          </Button>
        </div>
      )}
      <div className="p-1 flex items-center rounded bg-white shadow">
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
          onClick={handleClickStateManager}
          className="hover:bg-gray-200 h-9 w-9 text-gray-500"
          title="State Manager"
        >
          <i className="fa-solid fa-sliders" />
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
        {/* <Button
          intent="custom"
          size="custom"
          onClick={handleClickAssistant}
          className="hover:bg-gray-200 h-9 w-9 text-gray-500"
          title="Assistant"
        >
          <i className="fa-solid fa-star" />
        </Button> */}
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

BuilderAreaFooter.propTypes = {
  displayBorderComponents: PropTypes.oneOf(DISPLAY_BORDER),
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
  setDragTree: PropTypes.func
};

export default BuilderAreaFooter;
