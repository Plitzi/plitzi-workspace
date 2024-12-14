// Packages
import React, { use } from 'react';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import ContainerAutoScale from '@plitzi/plitzi-ui-components/ContainerAutoScale';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import Icon from '@plitzi/plitzi-ui/Icon';
import Flex from '@plitzi/plitzi-ui/Flex';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

/**
 * @param {{
 *   id?: string;
 *   name?: string;
 *   onSelect?: () => void;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PageLayout = props => {
  const { id = '', name = '', onSelect = noop, onRemove = noop } = props;
  const { schema } = use(SchemaContext);
  const {
    style: { cache }
  } = use(StyleContext);

  return (
    <div
      className="group flex flex-col relative overflow-hidden rounded-lg border w-full my-2 cursor-pointer"
      onClick={onSelect}
    >
      <ContainerAutoScale className="flex items-center justify-center h-[150px] w-full overflow-hidden">
        <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="w-full h-full" />
      </ContainerAutoScale>
      <div className="hidden group-hover:flex">
        <div className="bg-black opacity-50 absolute top-0 bottom-0 left-0 right-0" />
        <div className="flex bg-white rounded-lg absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
          <div className="py-2 px-4 text-blue-400 w-full flex items-center text-center font-bold select-none">
            {name}
          </div>
        </div>
      </div>
      <div className="absolute top-0 right-0">
        <Dropdown showIcon={false} containerTopOffset={5} containerLeftOffset={0}>
          <Dropdown.Content>
            <Flex
              items="center"
              justify="center"
              className="h-8 w-8 text-white rounded-bl-3xl bg-[linear-gradient(to_bottom_left,rgba(0,0,0,0.7)_5%,rgba(0,0,0,0.5)_0%,transparent_90%)] group-hover:bg-none"
            >
              <Icon intent="custom" icon="fa-solid fa-ellipsis" />
            </Flex>
          </Dropdown.Content>
          <Dropdown.Container className="flex flex-col rounded-none rounded-tl-lg rounded-bl-lg">
            <Button
              intent="custom"
              size="custom"
              className="h-7 w-8 text-red-400 hover:text-red-500"
              title="Remove"
              onClick={onRemove}
            >
              <i className="fas fa-trash-alt" />
            </Button>
          </Dropdown.Container>
        </Dropdown>
      </div>
    </div>
  );
};

export default PageLayout;
