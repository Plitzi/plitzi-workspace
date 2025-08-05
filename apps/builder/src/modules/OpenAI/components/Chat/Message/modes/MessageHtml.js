// Packages
import React, { useCallback, useEffect, use, useState } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';
import Markdown from '@plitzi/plitzi-ui-components/Markdown';
import Button from '@plitzi/plitzi-ui-components/Button';
import { useToast } from '@plitzi/plitzi-ui/Toast';

// Monorepo
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';
import TransformPreview from '@pmodules/Transformers/TransformPreview';

/**
 * @param {{
 *   className?: string;
 *   content: string;
 * }} props
 * @returns {React.ReactElement}
 */
const MessageHtml = props => {
  const { className = '', content = '' } = props;
  const { server, webKey } = use(NetworkContext);
  const { elementSelected } = use(BuilderSelectedContext);
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
    async content => {
      const response = await networkQuery(
        '/utils/transform-to-schema',
        { body: content, mode: 'html-tailwind' },
        'post'
      );
      const data = get(response, 'data');
      if (!data) {
        setPreview(EMPTY_SCHEMA);
      } else {
        setPreview(data);
      }
    },
    [networkQuery]
  );

  useEffect(() => {
    transformQuery(content);
  }, [content]);

  const handleClickCode = useCallback(() => setViewMode('code'), []);

  const handleClickPreview = useCallback(() => setViewMode('preview'), []);

  const handleClickExpand = useCallback(() => setFullScreen(state => !state), []);

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
      'schemaAddTemplate',
      elementSelected,
      pick(baseElement, ['id', 'definition', 'attributes']),
      'inside',
      elements,
      stylePlatform
    );
  }, [builderHandler, elementSelected, preview, baseElementId]);

  return (
    <div className={classNames('flex', className)}>
      <div
        className={classNames('flex w-full overflow-x-auto', {
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
            <i className="fas fa-code" />
          </Button>
        )}
        {viewMode === 'code' && (
          <Button size="sm" className="h-6 w-6 rounded-sm" title="Preview" onClick={handleClickPreview}>
            <i className="fa-solid fa-pen-ruler" />
          </Button>
        )}
        <Button size="sm" className="h-6 w-6 rounded-sm" title="Import" onClick={handleClickImport}>
          <i className="fa-solid fa-plus" />
        </Button>
        <Button
          size={fullScreen ? 'lg' : 'sm'}
          className={classNames('rounded-sm', {
            'h-6 w-6': !fullScreen,
            'absolute top-4 right-4 z-20 h-10 w-10 text-lg': fullScreen
          })}
          title={fullScreen ? 'Minimize' : 'Maximize'}
          onClick={handleClickExpand}
        >
          {!fullScreen && <i className="fa-solid fa-up-right-and-down-left-from-center" />}
          {fullScreen && <i className="fa-solid fa-down-left-and-up-right-to-center" />}
        </Button>
      </div>
    </div>
  );
};

export default MessageHtml;
