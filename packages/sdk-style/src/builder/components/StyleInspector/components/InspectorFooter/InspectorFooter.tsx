import Icon from '@plitzi/plitzi-ui/Icon';
import Switch from '@plitzi/plitzi-ui/Switch';

import { LEGEND } from './helpers';

import type { ChangeEvent } from 'react';

export type InspectorFooterProps = {
  replaceTokens: boolean;
  showAllOptions: boolean;
  canShowAllOptions: boolean;
  onCollapseAll: () => void;
  onChangeReplaceTokens: (e: ChangeEvent<HTMLInputElement>) => void;
  onChangeShowAllOptions: (e: ChangeEvent<HTMLInputElement>) => void;
};

const InspectorFooter = ({
  replaceTokens,
  showAllOptions,
  canShowAllOptions,
  onCollapseAll,
  onChangeReplaceTokens,
  onChangeShowAllOptions
}: InspectorFooterProps) => (
  <div className="border-ui-line flex items-center justify-between gap-3 border-t px-2.5 py-1.5">
    <div className="text-ui-fg-subtle flex items-center gap-3">
      <Icon
        className="hover:text-ui-fg cursor-pointer text-xs"
        icon="fa-solid fa-angles-up"
        title="Collapse every category"
        onClick={onCollapseAll}
      />
      <Icon className="cursor-help text-xs" icon="fa-solid fa-circle-info" title={LEGEND} />
    </div>
    <div className="flex items-center gap-3 whitespace-nowrap">
      <Switch
        size="xs"
        label="Token values"
        title="Show what each token resolves to instead of its name"
        checked={replaceTokens}
        onChange={onChangeReplaceTokens}
      />
      {canShowAllOptions && (
        <Switch
          size="xs"
          label="All options"
          title="Show every category, including the ones this element does not use"
          checked={showAllOptions}
          onChange={onChangeShowAllOptions}
        />
      )}
    </div>
  </div>
);

export default InspectorFooter;
