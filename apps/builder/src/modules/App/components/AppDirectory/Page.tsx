import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Text from '@plitzi/plitzi-ui/Text';
import get from 'lodash/get';
import { useCallback, use, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

import PageActions from './PageActions';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type PageProps = {
  id?: string;
  active?: boolean;
  nestedLevel?: number;
};

const Page = ({ id = '', active = false, nestedLevel = 0 }: PageProps) => {
  const {
    schema,
    schema: { flat }
  } = use(SchemaContext);
  const {
    style: { cache }
  } = use(StyleContext);
  const [zoom, setZoom] = useState(false);
  const styleMemo = useMemo(() => ({ paddingLeft: nestedLevel * 16 }), [nestedLevel]);
  const page = useMemo(() => get(flat, id, undefined), [flat, id]);

  const handleClickZoom = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZoom(state => !state);
  }, []);

  if (!page) {
    return undefined;
  }

  const {
    attributes: { name, default: defaultPage },
    definition: { label, type }
  } = page as Element & { attributes: { name: string; default: boolean } };

  return (
    <Flex className="group">
      <Link to={id} className="flex min-w-0 grow basis-0 flex-col">
        <Flex basis={0} grow gap={2} items="center" justify="between">
          <Flex grow items="center" basis={0} gap={2} className="overflow-hidden" style={styleMemo}>
            <Icon
              size="xs"
              cursor="pointer"
              active={active}
              intent={active ? 'primary' : 'custom'}
              icon={defaultPage ? 'fas fa-home' : 'fa-solid fa-file'}
            />
            <Text size="sm" isTruncated active={active}>
              {name ? name : label ? label : type}
            </Text>
          </Flex>
          <PageActions id={id} active={active} zoom={zoom} defaultPage={defaultPage} onZoom={handleClickZoom} />
        </Flex>
        {zoom && (
          <div className="m-4 rounded-sm border border-gray-300 p-4">
            <ContainerAutoScale className="flex h-[150px] w-full items-center justify-center overflow-hidden rounded-sm">
              <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="h-full w-full" />
            </ContainerAutoScale>
          </div>
        )}
      </Link>
    </Flex>
  );
};

export default Page;
