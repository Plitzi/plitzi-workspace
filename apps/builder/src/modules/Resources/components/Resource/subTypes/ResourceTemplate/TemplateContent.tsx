import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { Schema, Style } from '@plitzi/sdk-shared';

export type TemplateContentProps = {
  name: string;
  baseElementId: string;
  schema: Schema;
  style: Style;
};

const TemplateContent = ({ name, baseElementId, schema, style }: TemplateContentProps) => {
  const builderSchemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const builderStyleValueMemo = useMemo(() => ({ style }), [style]);

  return (
    <div className="flex aspect-video h-full w-full flex-col gap-2 overflow-hidden">
      <div className="relative flex flex-col overflow-hidden rounded-lg">
        <SchemaContext value={builderSchemaValueMemo}>
          <StyleContext value={builderStyleValueMemo}>
            <ContainerAutoScale className="flex h-[184px] w-full items-center justify-center overflow-hidden rounded-sm">
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
      </div>
    </div>
  );
};

export default TemplateContent;
