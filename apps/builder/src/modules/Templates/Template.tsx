import Button from '@plitzi/plitzi-ui/Button';
import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import { useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { Schema, Style } from '@plitzi/sdk-shared';
import type { DragEvent } from 'react';

export type TemplateProps = {
  name: string;
  schema: Schema;
  style: Style;
  baseElementId: string;
  onDragStart?: (e: DragEvent) => void;
  onSettings?: () => void;
  onRemove?: () => void;
};

const Template = ({ name, schema, style, baseElementId, onDragStart, onSettings, onRemove }: TemplateProps) => {
  const builderSchemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const builderStyleValueMemo = useMemo(() => ({ style }), [style]);

  return (
    <div className="group my-2 flex w-full cursor-grabbing flex-col" onDragStart={onDragStart} draggable>
      <div className="relative flex flex-col overflow-hidden rounded-lg border">
        <SchemaContext value={builderSchemaValueMemo}>
          <StyleContext value={builderStyleValueMemo}>
            <ContainerAutoScale className="page-list-item__content flex h-[150px] w-full items-center justify-center overflow-hidden rounded-sm">
              <BuilderAreaPreview
                id={baseElementId}
                schema={schema}
                styleCache={style.cache}
                className="h-full w-full"
                previewMode
              />
            </ContainerAutoScale>
          </StyleContext>
        </SchemaContext>
        <div className="hidden group-hover:flex">
          <div className="absolute top-0 right-0 bottom-0 left-0 bg-black opacity-50" />
          <div className="absolute top-[50%] left-[50%] flex translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white">
            <div className="flex w-full items-center px-4 py-2 text-center font-bold text-blue-400 select-none">
              {name}
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0">
          <ContainerFloating containerTopOffset={5} containerLeftOffset={0}>
            <ContainerFloating.Trigger>
              <div className="flex h-7 w-8 items-center justify-center rounded-bl-lg border-b border-l bg-white hover:text-blue-400">
                <i className="fa-solid fa-ellipsis" />
              </div>
            </ContainerFloating.Trigger>
            <ContainerFloating.Content className="rounded-none rounded-tl-lg rounded-bl-lg">
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
            </ContainerFloating.Content>
          </ContainerFloating>
        </div>
      </div>
    </div>
  );
};

export default Template;
