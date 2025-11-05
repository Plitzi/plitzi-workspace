import Alert from '@plitzi/plitzi-ui/Alert';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';
import { useCallback, use, useMemo, useRef, useState } from 'react';

import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import useNetwork from '@pmodules/Network/hooks/useNetwork';

import TransformActions from './TransformActions';
import TransformLayout from './TransformLayout';
import TransformPreview from './TransformPreview';

import type { ResizeHandle } from '@plitzi/plitzi-ui/ContainerResizable';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { ClipboardEvent } from 'react';

const Transform = () => {
  const editorRef = useRef<HTMLElement | null>(null);
  const { server, webKey } = use(NetworkContext);
  const { addToast } = useToast();
  const {
    builderHandler,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const {
    style: { mode: styleMode }
  } = use(StyleContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const { rootDOM } = use(ContainerRootContext);
  const [mode, setMode] = useState<'html-tailwind' | 'webflow'>('html-tailwind');
  const [isEditorVisible, setEditorVisible] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const [preview, setPreview] = useState(EMPTY_SCHEMA);
  const [content, setContent] = useState<string>('');
  const [hideAlert, setHideAlert] = useState(false);

  const transformQuery = useCallback(
    async (content: string) => {
      const response = await networkQuery<{
        data: { definition: { rootId: string }; schema: Schema; style: Style };
      }>('/utils/transform-to-schema', { body: content, mode }, 'post');
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
    setHideAlert(false);
  }, [content, transformQuery]);

  const handleClickImport = useCallback(() => {
    if (!elementSelected) {
      addToast('Select an element before import the template', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    const rootId = get(preview, 'definition.rootId');
    const baseElement = get(preview, `schema.flat.${rootId}`, undefined);
    const elements = get(preview, 'schema.flat', undefined);
    const stylePlatform = get(preview, 'style.platform', undefined);
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
      'schemaAddTemplate',
      elementSelected,
      pick(baseElement, ['id', 'definition', 'attributes']),
      'inside',
      elements,
      stylePlatform
    );
  }, [elementSelected, preview, baseElementId, builderHandler, addToast]);

  const handleChangeContent = useCallback((value: string) => setContent(value), [setContent]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    if (!editorRef.current || !editorRef.current.contains(e.target as HTMLDivElement)) {
      return;
    }

    const { clipboardData } = e;
    if (clipboardData.types.includes('application/json')) {
      setContent(clipboardData.getData('application/json'));
    }
  }, []);

  const handleClickCloseAlert = useCallback(() => setHideAlert(true), []);

  const resizeHandles = useMemo<ResizeHandle[]>(() => {
    if (layoutMode === 'horizontal') {
      return ['w'];
    }

    return ['n'];
  }, [layoutMode]);

  const handleChangeMode = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      setMode((option?.value ?? 'html-tailwind') as typeof mode);
      setPreview(EMPTY_SCHEMA);
    },
    [setMode]
  );

  const handleChangeLayoutMode = useCallback(
    (option?: Exclude<Option, OptionGroup>) => setLayoutMode((option?.value ?? 'horizontal') as typeof layoutMode),
    [setLayoutMode]
  );

  const handleClickEditorVisible = useCallback(() => setEditorVisible(!isEditorVisible), [isEditorVisible]);

  const handleClickEraser = useCallback(() => {
    setContent('');
    setPreview(EMPTY_SCHEMA);
  }, []);

  const cmMode = useMemo(() => {
    switch (mode) {
      case 'webflow':
        return 'json';

      case 'html-tailwind':
      default:
        return 'html';
    }
  }, [mode]);

  const warning = styleMode !== preview.style.mode && !!preview.definition.rootId;

  return (
    <div className="flex h-full flex-col">
      <div className={classNames('flex h-full overflow-y-auto', { 'flex-col': layoutMode === 'vertical' })}>
        <div className="relative flex grow basis-0 flex-col overflow-y-auto">
          <TransformPreview preview={preview} previewMode />
          {warning && !hideAlert && (
            <div className="absolute right-1 bottom-1 left-0">
              <Alert intent="warning" solid={false} size="xs" closeable onClick={handleClickCloseAlert}>
                {mode === 'html-tailwind' && (
                  <p className="inline gap-1">
                    {'Tailwind uses a mobile-first breakpoint system, '}
                    <a
                      href="https://tailwindcss.com/docs/responsive-design"
                      target="_blank"
                      className="font-bold underline"
                    >
                      Click Here
                    </a>
                    {' for more information or update your settings'}
                  </p>
                )}
              </Alert>
            </div>
          )}
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
                className={classNames('relative flex grow', { 'flex-col': layoutMode === 'horizontal' })}
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
      <div className="flex items-center justify-between gap-3 border-t border-gray-400 p-2">
        <TransformLayout
          layoutMode={layoutMode}
          onLayoutModeChange={handleChangeLayoutMode}
          isEditorVisible={isEditorVisible}
          onClickEditorVisible={handleClickEditorVisible}
        />
        <TransformActions
          mode={mode}
          loading={networkLoading}
          compileDisabled={content === '' || networkLoading}
          disabled={networkLoading || !preview.definition.rootId}
          warning={warning}
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
