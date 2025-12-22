import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Text from '@plitzi/plitzi-ui/Text';
import { useCallback, use, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

import ItemActions from './ItemActions';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type DirectoryItemProps = {
  element: Element;
  active?: boolean;
  nestedLevel?: number;
};

const DirectoryItem = ({ element, active = false, nestedLevel = 0 }: DirectoryItemProps) => {
  const { schema } = use(SchemaContext);
  const {
    style: { cache }
  } = use(StyleContext);
  const {
    server: { basePath }
  } = use(NetworkContext);
  const { eventBridge } = use(EventBridgeContext);
  const [zoom, setZoom] = useState(false);
  const styleMemo = useMemo(() => ({ paddingLeft: nestedLevel * 16 }), [nestedLevel]);

  const handleClickZoom = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZoom(state => !state);
  }, []);

  const {
    id,
    attributes: { name, default: defaultPage },
    definition: { label, type }
  } = element as Element & { attributes: { name: string; default: boolean } };

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (type === 'layoutContainer') {
        e.stopPropagation();
        e.preventDefault();
        void eventBridge.emit('builder', 'builderSetBaseContext', id);
      }
    },
    [eventBridge, id, type]
  );

  return (
    <Flex className="group">
      <Link
        to={basePath ? `${basePath}/${id}` : id}
        relative="path"
        className="flex min-w-0 grow basis-0 flex-col"
        onClick={handleClick}
      >
        <Flex basis={0} grow gap={2} items="center" justify="between">
          <Flex grow items="center" basis={0} gap={2} className="overflow-hidden" style={styleMemo}>
            <Icon
              size="sm"
              cursor="pointer"
              active={active}
              intent={active ? 'primary' : 'custom'}
              icon={
                type === 'layoutContainer' ? 'fa-solid fa-border-all' : defaultPage ? 'fas fa-home' : 'fa-solid fa-file'
              }
              title={type === 'layoutContainer' ? 'Layout' : 'Page'}
            />
            <Text size="sm" isTruncated active={active}>
              {name ? name : label ? label : type}
            </Text>
          </Flex>
          <ItemActions
            id={id}
            active={active}
            type={type}
            zoom={zoom}
            defaultPage={defaultPage}
            onZoom={handleClickZoom}
          />
        </Flex>
        {zoom && (
          <div className="relative my-2 rounded-sm border border-gray-300">
            <ContainerAutoScale className="flex h-37.5 w-full items-center justify-center overflow-hidden rounded-sm">
              <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="h-full w-full" previewMode />
            </ContainerAutoScale>
          </div>
        )}
      </Link>
    </Flex>
  );
};

export default DirectoryItem;
