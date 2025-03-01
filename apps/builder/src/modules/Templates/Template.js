import Button from '@plitzi/plitzi-ui/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import { useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

import { ContainerAutoScale } from '@plitzi/plitzi-ui-components';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

const Template = ({ name, schema, style, baseElementId, onDragStart, onSettings, onRemove }) => {
  const builderSchemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const builderStyleValueMemo = useMemo(() => ({ style }), [style]);

  return (
    <div className="group flex flex-col w-full my-2 cursor-grabbing" onDragStart={onDragStart} draggable>
      <div className="flex flex-col relative overflow-hidden rounded-lg border">
        <SchemaContext value={builderSchemaValueMemo}>
          <StyleContext value={builderStyleValueMemo}>
            <ContainerAutoScale className="page-list-item__content flex items-center justify-center h-[150px] w-full overflow-hidden rounded-sm">
              <BuilderAreaPreview
                id={baseElementId}
                schema={schema}
                styleCache={style.cache}
                className="w-full h-full"
                previewMode
              />
            </ContainerAutoScale>
          </StyleContext>
        </SchemaContext>
        <div className="hidden group-hover:flex">
          <div className="bg-black opacity-50 absolute top-0 bottom-0 left-0 right-0" />
          <div className="flex bg-white rounded-lg absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
            <div className="py-2 px-4 text-blue-400 w-full flex items-center font-bold select-none text-center">
              {name}
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0">
          <Dropdown showIcon={false} containerTopOffset={5} containerLeftOffset={0}>
            <Dropdown.Content>
              <div className="h-7 w-8 hover:text-blue-400 flex items-center justify-center border-b border-l rounded-bl-lg bg-white ">
                <i className="fa-solid fa-ellipsis" />
              </div>
            </Dropdown.Content>
            <Dropdown.Container className="rounded-none rounded-tl-lg rounded-bl-lg">
              <div className="flex flex-col">
                <Button
                  intent="custom"
                  size="custom"
                  className="h-7 w-8 hover:text-blue-400"
                  title="Settings"
                  onClick={onSettings}
                >
                  <i className="fas fa-cog" />
                </Button>
                <Button
                  intent="custom"
                  size="custom"
                  className="h-7 w-8 text-red-400 hover:text-red-500"
                  title="Remove"
                  onClick={onRemove}
                >
                  <i className="fas fa-trash-alt" />
                </Button>
              </div>
            </Dropdown.Container>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default Template;
