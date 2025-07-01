// Packages
import React, { useCallback, use, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import TransformActions from './TransformActions';
import TransformLayout from './TransformLayout';
import TransformPreview from './TransformPreview';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Transform = props => {
  const { className = '' } = props;
  const editorRef = useRef();
  const { server, webKey } = use(NetworkContext);
  const { addToast } = useToast();
  const {
    builderHandler,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const { rootDOM } = use(ContainerRootContext);
  const [mode, setMode] = useState('html-tailwind');
  const [isEditorVisible, setEditorVisible] = useState(true);
  const [layoutMode, setLayoutMode] = useState('horizontal');
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const [preview, setPreview] = useState(EMPTY_SCHEMA);
  const [content, setContent] = useState('');

  const transformQuery = useCallback(
    async content => {
      const response = await networkQuery('/utils/transform-to-schema', { body: content, mode }, 'post');
      const data = get(response, 'data');
      if (!data) {
        return EMPTY_SCHEMA;
      }

      return data;
    },
    [networkQuery, mode]
  );

  const handleClickTransform = useCallback(async () => {
    const data = await transformQuery(content);
    setPreview(data);
  }, [content, transformQuery]);

  const handleClickImport = useCallback(async () => {
    if (!elementSelected) {
      addToast('Select an element before import the template', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    const rootId = get(preview, 'definition.rootId');
    const baseElement = get(preview, `schema.flat.${rootId}`);
    const elements = get(preview, 'schema.flat');
    const stylePlatform = get(preview, 'style.platform', {});
    if (!rootId || !baseElement || !elements || !stylePlatform) {
      addToast('The template seems to be empty or something is missing', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    console.log(stylePlatform);

    // set(baseElement, 'definition.rootId', baseElementId);
    // Object.values(elements).forEach(element => {
    //   set(elements, `${element.id}.definition.rootId`, baseElementId);
    // });

    // set(baseElement, 'definition.parentId', elementSelected);

    // builderHandler(
    //   'schemaAddTemplate',
    //   elementSelected,
    //   pick(baseElement, ['id', 'definition', 'attributes']),
    //   'inside',
    //   elements,
    //   stylePlatform
    // );
  }, [builderHandler, elementSelected, preview, baseElementId]);

  const handleChangeContent = useCallback(value => setContent(value), [setContent]);

  const handlePaste = useCallback(async e => {
    if (!editorRef.current || !editorRef.current.contains(e.target)) {
      return;
    }

    const { clipboardData } = e;
    if (clipboardData.types.includes('application/json')) {
      setContent(clipboardData.getData('application/json'));
    }
  });

  const resizeHandles = useMemo(() => {
    if (layoutMode === 'horizontal') {
      return ['w'];
    }

    return ['n'];
  }, [layoutMode]);

  const handleChangeMode = useCallback(
    e => {
      setMode(e.value);
      setPreview(EMPTY_SCHEMA);
    },
    [setMode]
  );

  const handleChangeLayoutMode = useCallback(e => setLayoutMode(e.value), [setLayoutMode]);

  const handleClickEditorVisible = useCallback(() => setEditorVisible(!isEditorVisible), [isEditorVisible]);

  const handleClickEraser = useCallback(() => {
    setContent('');
    setPreview(EMPTY_SCHEMA);
  }, []);

  const cmMode = useMemo(() => {
    switch (mode) {
      case 'webflow':
        return 'json';

      case 'tailwind':
      default:
        return 'html';
    }
  }, [mode]);

  return (
    <div className={classNames('flex h-full flex-col', className)}>
      <div className={classNames('flex h-full overflow-y-auto', { 'flex-col': layoutMode === 'vertical' })}>
        <div className="flex grow basis-0 flex-col overflow-y-auto">
          <TransformPreview preview={preview} />
        </div>
        {isEditorVisible && (
          <div
            className={classNames('flex bg-white', {
              'h-full': layoutMode === 'horizontal',
              'w-full': layoutMode === 'vertical'
            })}
          >
            <ContainerResizable
              className="grow"
              autoGrow={false}
              minConstraintsX={layoutMode === 'horizontal' ? 200 : 100}
              minConstraintsY={layoutMode === 'horizontal' ? 100 : 200}
              maxConstraintsX={layoutMode === 'horizontal' ? 1200 : Infinity}
              maxConstraintsY={layoutMode === 'horizontal' ? Infinity : 800}
              width={layoutMode === 'horizontal' ? 200 : Infinity}
              height={layoutMode === 'horizontal' ? Infinity : 200}
              resizeHandles={resizeHandles}
              parentElement={rootDOM}
              axis={layoutMode === 'horizontal' ? 'x' : 'y'}
            >
              <div
                className={classNames('flex grow', { 'flex-col': layoutMode === 'horizontal' })}
                onPaste={handlePaste}
              >
                <CodeMirror
                  ref={editorRef}
                  className={classNames('grow', {
                    'h-full': layoutMode === 'horizontal',
                    'w-full grow': layoutMode === 'vertical'
                  })}
                  value={content}
                  theme="dark"
                  mode={cmMode}
                  lineWrapping
                  onChange={handleChangeContent}
                />
              </div>
            </ContainerResizable>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-gray-400 p-2">
        <TransformLayout
          layoutMode={layoutMode}
          onLayoutModeChange={handleChangeLayoutMode}
          isEditorVisible={isEditorVisible}
          onClickEditorVisible={handleClickEditorVisible}
        />
        <TransformActions
          mode={mode}
          disabled={networkLoading}
          onChangeMode={handleChangeMode}
          onClickEraser={handleClickEraser}
          onTransform={handleClickTransform}
          onImport={handleClickImport}
        />
      </div>
    </div>
  );
};

export default Transform;
