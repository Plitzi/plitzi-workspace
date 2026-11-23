import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { use, useCallback, useMemo } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import {
  DEFAULT_VARIANT_WEIGHT,
  EXPERIMENT_VARIANTS,
  isExperimentWeight,
  variantAt
} from '@plitzi/sdk-shared/experiments';
import { hasConditions } from '@plitzi/sdk-shared/flags';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { useBuilderStore, useCommonStore } from '@plitzi/sdk-shared/store';
import { isChooseBy } from '@plitzi/sdk-shared/variants';

import { audienceRuleFields } from '../../../../builder/ruleFields';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

const NO_RULES: RuleGroup = { combinator: 'and', rules: [] };

type SettingsProps = {
  id?: string;
  weight?: number;
  when?: RuleGroup;
  onUpdate?: (key: string, value: RuleGroup | number) => void;
};

/**
 * A variant's settings: what it is to the Variants element it is in — its letter or its place — and, as that element
 * chooses, its share of the visitors or the rule of the ones it is for. The way back to the element is one press.
 */
const Settings = ({ id = '', weight = DEFAULT_VARIANT_WEIGHT, when = NO_RULES, onUpdate }: SettingsProps) => {
  const [[parentId = '']] = useCommonStore([`schema.flat.${id}.definition.parentId`]);
  const [[parentChooseBy, parentShown, siblings = [], parent]] = useCommonStore([
    `schema.flat.${parentId}.attributes.chooseBy`,
    `schema.flat.${parentId}.attributes.builderVariant`,
    `schema.flat.${parentId}.definition.items`,
    `schema.flat.${parentId}`
  ]);
  const [siblingWeights] = useCommonStore(siblings.map(sibling => `schema.flat.${sibling}.attributes.weight` as const));
  const [[routeParams = {}, queryParams = {}, visitorRoles]] = useCommonStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings.visitorRoles'
  ]);
  const [, setSelected] = useBuilderStore('elementSelected');
  const { builderHandler } = use(BuilderContext);

  const chooseBy = isChooseBy(parentChooseBy) ? parentChooseBy : 'chance';
  const index = siblings.indexOf(id);
  const fields = useMemo(
    () => audienceRuleFields({ routeParams, queryParams, visitorRoles: Object.keys(visitorRoles ?? {}) }),
    [routeParams, queryParams, visitorRoles]
  );
  const total = siblingWeights
    .slice(0, EXPERIMENT_VARIANTS.length)
    .reduce<number>((sum, each) => sum + (isExperimentWeight(each) ? each : DEFAULT_VARIANT_WEIGHT), 0);
  const percent = total > 0 ? Math.round((weight / total) * 100) : 0;
  const shownInCanvas = parentShown === index;

  const handleWeight = useCallback(
    (value: string) => {
      const share = Number(value);
      // A whole share, 0–100: what cannot be read as one is left as it was rather than written as 0, which would take
      // the variant out of the test.
      if (value.trim() !== '' && Number.isFinite(share)) {
        onUpdate?.('weight', Math.min(100, Math.max(0, Math.round(share))));
      }
    },
    [onUpdate]
  );

  const handleRule = useCallback((query: RuleGroup) => onUpdate?.('when', query), [onUpdate]);
  const handleOpenParent = useCallback(() => setSelected(parentId), [parentId, setSelected]);
  // The Variants element whole, changed: a panel writes another element by handing it to the builder — `updateElement` writes
  // only the one selected.
  const handleShow = useCallback(() => {
    // A variant moved out of its Variants element has none to write: the store's path type says every element is there.
    if (isRecord(parent)) {
      builderHandler('schemaUpdateElement', { ...parent, attributes: { ...parent.attributes, builderVariant: index } });
    }
  }, [builderHandler, index, parent]);

  const name =
    chooseBy === 'chance'
      ? `Variant ${variantAt(index)?.toUpperCase() ?? String(index + 1)}`
      : `Variant ${String(index + 1)}`;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="bg-ui-raised flex items-center justify-between gap-2 rounded-lg px-2.5 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-ui-fg text-xs font-semibold">{name}</span>
          <span className="text-ui-fg-subtle truncate text-[11px]">
            of {parentId}, chosen {chooseBy === 'chance' ? 'by chance' : 'by rules'}
          </span>
        </div>
        <Button size="xs" intent="secondary" onClick={handleOpenParent}>
          <Button.Icon icon="fa-solid fa-arrow-up" />
          All variants
        </Button>
      </div>
      {chooseBy === 'chance' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-2">
            <Input
              className="w-24"
              type="number"
              label="Share (%)"
              size="xs"
              min={0}
              max={100}
              value={String(weight)}
              onChange={handleWeight}
            />
            <span className="text-ui-fg-muted pb-1.5 text-xs">of the visitors</span>
          </div>
          {total === 100 ? (
            <span className="text-ui-fg-subtle text-xs">
              A percent of the visitors: all the variants’ shares add up to 100%. 0 shows it to nobody.
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              The variants’ shares add up to {total}%, not 100%: this one is read as {percent}% until they do. Fix them
              in All variants.
            </span>
          )}
        </div>
      )}
      {chooseBy === 'rules' && (
        <div className="flex flex-col gap-1">
          <span className="text-ui-fg text-xs font-medium">Shown to visitors who match</span>
          <QueryBuilder
            direction="vertical"
            intent="gray"
            className="w-full"
            query={when}
            fields={fields}
            onChange={handleRule}
            showBranches
          />
          <span className="text-ui-fg-subtle text-xs">
            {hasConditions(when)
              ? 'The first variant whose rule a visitor matches is the one they see.'
              : 'No rule: it is for everyone the variants before it did not take — keep it last.'}
          </span>
        </div>
      )}
      {!shownInCanvas && (
        <Button size="xs" intent="secondary" className="self-start" onClick={handleShow}>
          <Button.Icon icon="fa-regular fa-eye" />
          Show this one in the canvas
        </Button>
      )}
    </div>
  );
};

export default Settings;
