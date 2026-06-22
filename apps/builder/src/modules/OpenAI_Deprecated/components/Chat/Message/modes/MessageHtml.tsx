import Button from '@plitzi/plitzi-ui/Button';
import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import Markdown from '@plitzi/plitzi-ui/Markdown';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, useEffect, use, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import TransformPreview from '@pmodules/Transformers/TransformPreview';

import type { BuilderState, Schema, Style } from '@plitzi/sdk-shared';

export type MessageHtmlProps = {
  content?: string;
};

const MessageHtml = ({ content = '' }: MessageHtmlProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const { server, webKey } = use(NetworkContext);
  const [viewMode, setViewMode] = useState('preview');
  const [fullScreen, setFullScreen] = useState(false);
  const { addToast } = useToast();
  const [preview, setPreview] = useState(EMPTY_SCHEMA);
  const {
    builderHandler,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });

  const transformQuery = useCallback(
    async (content: string) => {
      const response = await networkQuery<{
        data: { schema: Schema; style: Style; definition: { rootId: string } };
      }>('/utils/transform-to-schema', { body: content, mode: 'html-tailwind' }, 'post');
      const data = get(response, 'data', undefined);
      if (!data) {
        setPreview(EMPTY_SCHEMA);
      } else {
        setPreview(data);
      }
    },
    [networkQuery]
  );

  useEffect(() => {
    void transformQuery(content);
  }, [content, transformQuery]);

  const handleClickCode = useCallback(() => setViewMode('code'), []);

  const handleClickPreview = useCallback(() => setViewMode('preview'), []);

  const handleClickExpand = useCallback(() => setFullScreen(state => !state), []);

  const handleClickImport = useCallback(() => {
    if (!elementSelected) {
      addToast('Select an element before import the template', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    const rootId = get(preview, 'definition.rootId', undefined);
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

  return (
    <div className="flex text-sm">
      <div
        className={clsx('flex w-full overflow-x-auto', {
          'rounded-sm border border-gray-300 p-0': viewMode === 'preview' && !fullScreen,
          'absolute top-0 right-0 bottom-0 left-0 z-10 bg-white': fullScreen
        })}
      >
        {viewMode === 'code' && <Markdown className="w-full">{content}</Markdown>}
        {viewMode === 'preview' && <TransformPreview preview={preview} />}
      </div>
      <div className="ml-2 flex flex-col gap-2">
        {viewMode === 'preview' && (
          <Button size="sm" className="h-6 w-6 rounded-sm" title="Code" onClick={handleClickCode}>
            <Button.Icon icon="fas fa-code" />
          </Button>
        )}
        {viewMode === 'code' && (
          <Button size="sm" className="h-6 w-6 rounded-sm" title="Preview" onClick={handleClickPreview}>
            <Button.Icon icon="fa-solid fa-pen-ruler" />
          </Button>
        )}
        <Button size="sm" className="h-6 w-6 rounded-sm" title="Import" onClick={handleClickImport}>
          <Button.Icon icon="fa-solid fa-plus" />
        </Button>
        <Button
          size={fullScreen ? 'md' : 'sm'}
          className={clsx('rounded-sm', {
            'h-6 w-6': !fullScreen,
            'absolute top-4 right-4 z-20 h-10 w-10 text-lg': fullScreen
          })}
          title={fullScreen ? 'Minimize' : 'Maximize'}
          onClick={handleClickExpand}
        >
          {!fullScreen && <Button.Icon icon="fa-solid fa-up-right-and-down-left-from-center" />}
          {fullScreen && <Button.Icon icon="fa-solid fa-down-left-and-up-right-to-center" />}
        </Button>
      </div>
    </div>
  );
};

export default MessageHtml;
