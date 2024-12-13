// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import get from 'lodash/get';
import Text from '@plitzi/plitzi-ui/Text';
import Icon from '@plitzi/plitzi-ui/Icon';
import Flex from '@plitzi/plitzi-ui/Flex';
import ContainerAutoScale from '@plitzi/plitzi-ui-components/ContainerAutoScale';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

// Relatives
import PageActions from './PageActions';

/**
 * @param {{
 *   id?: string;
 *   active?: boolean;
 *   nestedLevel?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const Page = props => {
  const { id = '', active = false, nestedLevel = 0 } = props;
  const {
    schema,
    schema: { flat }
  } = use(SchemaContext);
  const {
    style: { cache }
  } = use(StyleContext);
  const [zoom, setZoom] = useState(false);
  const styleMemo = useMemo(() => ({ paddingLeft: nestedLevel * 16 }), [nestedLevel]);
  const page = useMemo(() => get(flat, id, {}), [flat, id]);
  if (!page) {
    return undefined;
  }

  const {
    attributes: { name, default: defaultPage },
    definition: { label, type }
  } = page;

  const handleClickZoom = useCallback(e => {
    e.stopPropagation();
    e.preventDefault();
    setZoom(state => !state);
  }, []);

  return (
    <Flex className="group">
      <Link to={id} className="flex flex-col basis-0 min-w-0 grow">
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
              {name ?? label ?? type}
            </Text>
          </Flex>
          <PageActions id={id} active={active} zoom={zoom} defaultPage={defaultPage} onZoom={handleClickZoom} />
        </Flex>
        {zoom && (
          <div className="border border-gray-300 p-4 m-4 rounded">
            <ContainerAutoScale className="flex items-center justify-center h-[150px] w-full overflow-hidden rounded">
              <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="w-full h-full" />
            </ContainerAutoScale>
          </div>
        )}
      </Link>
    </Flex>
  );
};

export default Page;
