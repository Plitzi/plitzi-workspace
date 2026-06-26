import Accordion from '@plitzi/plitzi-ui/Accordion';
import Alert from '@plitzi/plitzi-ui/Alert';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use, useMemo, useRef, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import TransformActions from './TransformActions';
import TransformLayout from './TransformLayout';
import TransformPreview from './TransformPreview';

import type { ResizeHandle } from '@plitzi/plitzi-ui/ContainerResizable';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { ClipboardEvent } from 'react';

const Transform = () => {
  const { theme } = use(ThemeContext);
  const editorRef = useRef<HTMLElement | null>(null);
  const { server, webKey } = use(NetworkContext);
  const { addToast } = useToast();
  const {
    builderHandler,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const [[styleMode, elementSelected]] = useBuilderStore(['style.mode', 'elementSelected']);
  const { rootRef } = use(ContainerRootContext);
  const [mode, setMode] = useState<'html-tailwind' | 'webflow' | 'html'>('html-tailwind');
  const [isEditorVisible, setEditorVisible] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const [preview, setPreview] = useState(EMPTY_SCHEMA);
  const [content, setContent] = useState<string>('');
  const [customCss, setCustomCss] = useState<string>('');
  const [hideAlert, setHideAlert] = useState(false);

  const transformQuery = useCallback(
    async (content: string, customCss: string) => {
      const response = await networkQuery<{
        data: { definition: { rootId: string }; schema: Schema; style: Style };
      }>('/utils/transform-to-schema', { body: content, mode, 'custom-css': customCss }, 'post');
      const data = get(response, 'data', undefined);
      if (!data) {
        return EMPTY_SCHEMA;
      }

      return data;
    },
    [networkQuery, mode]
  );

  const handleClickTransform = useCallback(async () => {
    const data = await transformQuery(content, customCss);
    setPreview(data);
    setHideAlert(false);
  }, [content, customCss, transformQuery]);

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

  const handleChangeCustomStyle = useCallback((value: string) => setCustomCss(value), [setCustomCss]);

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

  const modeParsed = useMemo(() => {
    if (mode === 'html-tailwind') {
      return 'Html + Tailwind';
    }

    if (mode === 'webflow') {
      return 'Webflow';
    }

    return 'Html';
  }, [mode]);

  return (
    <div className="flex h-full flex-col">
      <div className={clsx('flex h-full overflow-y-auto', { 'flex-col': layoutMode === 'vertical' })}>
        <div className="relative flex grow basis-0 flex-col overflow-y-auto">
          <TransformPreview preview={preview} previewMode />
          {warning && !hideAlert && (
            <div className="absolute right-1 bottom-1 left-1">
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
            className={clsx('flex bg-white dark:bg-zinc-900', {
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
              parentRef={rootRef}
              axis={layoutMode === 'horizontal' ? 'x' : 'y'}
            >
              <div
                className={clsx('relative flex grow flex-col', { 'flex-col': layoutMode === 'horizontal' })}
                onPaste={handlePaste}
              >
                <Accordion grow multi size="xs" gap={0}>
                  <Accordion.Item className={{ itemDivider: 'translate-y-0' }}>
                    <Accordion.Item.Header title={modeParsed} />
                    <Accordion.Item.Content className="p-0">
                      <CodeMirror
                        ref={editorRef}
                        className={clsx('grow', {
                          'h-full': layoutMode === 'horizontal',
                          'w-full': layoutMode === 'vertical'
                        })}
                        value={content}
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        mode={cmMode}
                        lineWrapping
                        onChange={handleChangeContent}
                      />
                    </Accordion.Item.Content>
                  </Accordion.Item>
                  <Accordion.Item>
                    <Accordion.Item.Header title="Custom Styles" />
                    <Accordion.Item.Content className="p-0">
                      <CodeMirror
                        ref={editorRef}
                        mode="css"
                        className={clsx('grow', {
                          'h-full': layoutMode === 'horizontal',
                          'w-full': layoutMode === 'vertical'
                        })}
                        value={customCss}
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        lineWrapping
                        onChange={handleChangeCustomStyle}
                      />
                    </Accordion.Item.Content>
                  </Accordion.Item>
                </Accordion>
              </div>
            </ContainerResizable>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-400 p-2 dark:border-zinc-600">
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
