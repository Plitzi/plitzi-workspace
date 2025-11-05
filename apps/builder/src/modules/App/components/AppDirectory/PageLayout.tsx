import Button from '@plitzi/plitzi-ui/Button';
import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import { use } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

import type { MouseEvent } from 'react';

export type PageLayoutProps = {
  id?: string;
  name?: string;
  onSelect?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const PageLayout = ({ id = '', name = '', onSelect, onRemove }: PageLayoutProps) => {
  const { schema } = use(SchemaContext);
  const {
    style: { cache }
  } = use(StyleContext);

  return (
    <div
      className="group relative my-2 flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border"
      onClick={onSelect}
    >
      <ContainerAutoScale className="flex h-[150px] w-full items-center justify-center overflow-hidden">
        <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="h-full w-full" previewMode />
      </ContainerAutoScale>
      <div className="hidden group-hover:flex">
        <div className="absolute top-0 right-0 bottom-0 left-0 bg-black opacity-50" />
        <div className="absolute top-[50%] left-[50%] flex translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white">
          <div className="flex w-full items-center px-4 py-2 text-center select-none">{name}</div>
        </div>
      </div>
      <div className="absolute top-0 right-0">
        <ContainerFloating containerTopOffset={5} containerLeftOffset={0}>
          <ContainerFloating.Trigger>
            <Flex
              items="center"
              justify="center"
              className="h-8 w-8 rounded-bl-3xl bg-[linear-gradient(to_bottom_left,rgba(0,0,0,0.7)_5%,rgba(0,0,0,0.5)_0%,transparent_90%)] text-white group-hover:bg-none"
            >
              <Icon intent="custom" icon="fa-solid fa-ellipsis" />
            </Flex>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content className="flex flex-col rounded-none rounded-tl-lg rounded-bl-lg">
            <Button intent="danger" size="custom" className="h-7 w-8" title="Remove" onClick={onRemove}>
              <Button.Icon icon="fas fa-trash-alt" />
            </Button>
          </ContainerFloating.Content>
        </ContainerFloating>
      </div>
    </div>
  );
};

export default PageLayout;
