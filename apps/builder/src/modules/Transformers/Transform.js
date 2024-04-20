// Packages
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { DROP_DIRECTION_INSIDE } from '@plitzi/sdk-schema/FlatMap';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import BuilderSelectedContext from '@pmodules/Builder/contexts/BuilderSelectedContext';

// Relatives
import TransformActions from './TransformActions';
import TransformLayout from './TransformLayout';
import TransformPreview from './TransformPreview';

const Transform = props => {
  const { className = '' } = props;
  const editorRef = useRef();
  const { server, webKey } = useContext(NetworkContext);
  const { addToast } = useToast();
  const {
    builderHandler,
    baseContext: { baseElementId }
  } = useContext(BuilderContext);
  const { elementSelected } = useContext(BuilderSelectedContext);
  const { rootDOM } = useContext(ContainerRootContext);
  const [mode, setMode] = useState('html-tailwind');
  const [layoutMode, setLayoutMode] = useState('horizontal');
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const [preview, setPreview] = useState({
    schema: { flat: {} },
    style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
    definition: { rootId: '' }
  });
  const [content, setContent] = useState('');

  const transformQuery = useCallback(
    async content => {
      const response = await networkQuery('/utils/transform-to-schema', { body: content, mode }, 'post');
      const data = get(response, 'data');
      if (!data) {
        return {
          schema: { flat: {} },
          style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
          definition: { rootId: '' }
        };
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

    set(baseElement, 'definition.rootId', baseElementId);
    Object.values(elements).forEach(element => {
      set(elements, `${element.id}.definition.rootId`, baseElementId);
    });

    set(baseElement, 'definition.parentId', elementSelected);

    builderHandler(
      EventBridgeTypes.SCHEMA_ADD_TEMPLATE,
      elementSelected,
      pick(baseElement, ['id', 'definition', 'attributes']),
      DROP_DIRECTION_INSIDE,
      elements,
      stylePlatform
    );
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

  const resizeHandles = useMemo(() => ['w'], []);

  const handleChangeMode = useCallback(
    e => {
      setMode(e.value);
      setPreview({
        schema: { flat: {} },
        style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
        definition: { rootId: '' }
      });
    },
    [setMode]
  );

  const handleChangeLayoutMode = useCallback(e => setLayoutMode(e.value), [setLayoutMode]);

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
    <div className={classNames('h-full flex', className)}>
      <div className="flex flex-col grow basis-0 overflow-y-auto">
        <div className="flex grow overflow-y-auto w-full">
          <TransformPreview preview={preview} />
        </div>
        <div className="flex px-4 py-2 items-center justify-between border-t mt-2 border-gray-400">
          <TransformLayout layoutMode={layoutMode} onLayoutModeChange={handleChangeLayoutMode} />
          <TransformActions
            mode={mode}
            disabled={networkLoading}
            onChangeMode={handleChangeMode}
            onTransform={handleClickTransform}
            onImport={handleClickImport}
          />
        </div>
      </div>
      <div className="flex h-full bg-white">
        <ContainerResizable
          className={className}
          autoGrow={false}
          minConstraintsX={400}
          minConstraintsY={Infinity}
          maxConstraintsX={1000}
          width={400}
          resizeHandles={resizeHandles}
          parentElement={rootDOM}
        >
          <div className="flex flex-col grow" onPaste={handlePaste}>
            <CodeMirror
              ref={editorRef}
              className="h-full grow"
              value={content}
              theme="dark"
              mode={cmMode}
              // autoComplete={fieldsKeys}
              lineWrapping
              onChange={handleChangeContent}
            />
          </div>
        </ContainerResizable>
      </div>
    </div>
  );
};

Transform.propTypes = {
  className: PropTypes.string
};

export default Transform;
