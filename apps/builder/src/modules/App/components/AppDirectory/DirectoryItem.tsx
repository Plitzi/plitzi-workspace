import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Text from '@plitzi/plitzi-ui/Text';
import { useCallback, use, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { isNotFoundPage, pageFolderOf } from '@plitzi/sdk-shared/navigation';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

import ItemActions from './ItemActions';
import { pageProtection } from './protection';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type DirectoryItemProps = {
  element: Element;
  active?: boolean;
  nestedLevel?: number;
};

const DirectoryItem = ({ element, active = false, nestedLevel = 0 }: DirectoryItemProps) => {
  const [zoom, setZoom] = useState(false);
  const { eventBridge } = use(EventBridgeContext);
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

  // The page of every address nothing else answers in its place — the space, or its folder — sent with status 404.
  const notFound = type !== 'layoutContainer' && isNotFoundPage(element.attributes);
  const notFoundSays = pageFolderOf(element.attributes)
    ? 'The 404 page of its folder: every address in it no other page answers lands here, sent with status 404'
    : 'The 404 page: every address no other page answers lands here, sent with status 404';

  const protection = useMemo(
    () => (type === 'layoutContainer' ? undefined : pageProtection(element.attributes)),
    [type, element.attributes]
  );

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
    <Flex className="group hover:bg-ui-hover px-1">
      <Link to={id} relative="path" className="flex min-w-0 grow basis-0 flex-col" onClick={handleClick}>
        <Flex basis={0} grow gap={2} items="center" justify="between">
          <Flex grow items="center" basis={0} gap={2} className="overflow-hidden" style={styleMemo}>
            {/* What the page is, in its icon: a layout, the space's home, the page of every address nobody answers, a page. */}
            <Icon
              size="sm"
              cursor="pointer"
              active={active}
              intent={active ? 'primary' : 'custom'}
              icon={
                type === 'layoutContainer'
                  ? 'fa-solid fa-border-all'
                  : defaultPage
                    ? 'fas fa-home'
                    : notFound
                      ? 'fa-solid fa-file-circle-question'
                      : 'fa-solid fa-file'
              }
              {...(notFound && !active ? { className: 'text-amber-600 dark:text-amber-400' } : {})}
              title={type === 'layoutContainer' ? 'Layout' : notFound ? notFoundSays : 'Page'}
              {...(notFound ? { role: 'img', 'aria-label': notFoundSays } : {})}
            />
            <Text size="sm" isTruncated active={active}>
              {name ? name : label ? label : type}
            </Text>
            {protection && (
              <Icon
                size="xs"
                intent="custom"
                icon="fa-solid fa-lock"
                title={protection.says}
                role="img"
                aria-label={protection.says}
                className="text-ui-fg-subtle shrink-0"
              />
            )}
          </Flex>
          <ItemActions
            id={id}
            active={active}
            type={type}
            zoom={zoom}
            defaultPage={defaultPage}
            notFound={notFound}
            onZoom={handleClickZoom}
          />
        </Flex>
        {zoom && (
          <div className="border-ui-line-strong relative my-2 rounded-sm border">
            <ContainerAutoScale className="flex h-37.5 w-full items-center justify-center overflow-hidden rounded-sm">
              <BuilderAreaPreview id={id} className="h-full w-full" previewMode />
            </ContainerAutoScale>
          </div>
        )}
      </Link>
    </Flex>
  );
};

export default DirectoryItem;
