import get from 'lodash-es/get';
import { useCallback, use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

import type { Dispatch, SetStateAction } from 'react';

export type PageHeaderProps = {
  setTabSelected?: Dispatch<SetStateAction<string>>;
};

const PageHeader = ({ setTabSelected }: PageHeaderProps) => {
  const { pageDefinitions } = use(SchemaMainContext);
  const { currentPageId } = use(NavigationContext);

  const handleClick = useCallback(() => {
    setTabSelected?.((state: string) => (state === 'pages' ? '' : 'pages'));
  }, [setTabSelected]);

  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`, '') as string;
  const isHome = get(pageDefinitions, `${currentPageId}.attributes.default`, false) as boolean;

  return (
    <div
      className="flex w-31.5 min-w-0 grow basis-0 cursor-pointer items-center gap-1 text-xs select-none"
      title={pageLabel}
      onClick={handleClick}
    >
      {!isHome && <i className="fa-solid fa-file" />}
      {isHome && <i className="fas fa-home" />}
      <span className="truncate font-bold">{pageLabel}</span>
    </div>
  );
};

export default PageHeader;
