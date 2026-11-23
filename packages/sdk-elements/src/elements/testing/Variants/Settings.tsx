import Button from '@plitzi/plitzi-ui/Button';
import { pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import {
  DEFAULT_VARIANT_WEIGHT,
  EXPERIMENT_VARIANTS,
  experimentNameOf,
  isExperimentWeight,
  variantAt
} from '@plitzi/sdk-shared/experiments';
import { hasConditions } from '@plitzi/sdk-shared/flags';
import { useBuilderStore, useCommonStore } from '@plitzi/sdk-shared/store';
import { VARIANT_ITEM_TYPE } from '@plitzi/sdk-shared/variants';

import { audienceRuleFields } from '../../../builder/ruleFields';
import { ruleSummary } from '../../../builder/ruleSummary';
import useSettingsUpdate from '../../useSettingsUpdate';

import type { Element } from '@plitzi/sdk-shared';
import type { ChooseBy } from '@plitzi/sdk-shared/variants';

type SettingsProps = {
  id?: string;
  chooseBy?: ChooseBy;
  experiment?: string;
  builderVariant?: number;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const MODES: readonly { mode: ChooseBy; label: string; detail: string; icon: string }[] = [
  { mode: 'chance', label: 'By chance', detail: 'A/B test, by share', icon: 'fa-solid fa-shuffle' },
  { mode: 'rules', label: 'By rules', detail: 'Who is visiting', icon: 'fa-solid fa-filter' }
];

const HOW: Readonly<Record<ChooseBy, string>> = {
  chance: 'Each visitor is given a variant at random, by its share, and keeps it when they come back.',
  rules: 'Each visitor sees the first variant whose rule they match. The last, with no rule, is for everyone else.'
};

/** A variant's share as it is read: its own weight, or the default for one that says none. */
const weightOf = (attributes: Element['attributes'] | undefined): number =>
  isExperimentWeight(attributes?.weight) ? attributes.weight : DEFAULT_VARIANT_WEIGHT;

/** The share of the visitors a weight is, out of all of them: a whole percent. */
const percentOf = (weight: number, total: number): number => (total > 0 ? Math.round((weight / total) * 100) : 0);

/** The two ways it chooses, side by side: one is on. */
const ModeSwitch = ({ chooseBy, onChange }: { chooseBy: ChooseBy; onChange: (mode: ChooseBy) => void }) => (
  <div role="radiogroup" aria-label="Choose the variant" className="bg-ui-raised grid grid-cols-2 gap-1 rounded-lg p-1">
    {MODES.map(({ mode, label, detail, icon }) => (
      <button
        key={mode}
        type="button"
        role="radio"
        aria-checked={chooseBy === mode}
        className={clsx('flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors', {
          'bg-ui-panel text-ui-fg shadow-sm': chooseBy === mode,
          'text-ui-fg-muted hover:text-ui-fg': chooseBy !== mode
        })}
        onClick={() => onChange(mode)}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <i className={clsx(icon, 'text-[10px]')} />
          {label}
        </span>
        <span className="text-ui-fg-subtle text-[10px]">{detail}</span>
      </button>
    ))}
  </div>
);

type RowProps = {
  id: string;
  mark: string;
  shown: boolean;
  chooseBy: ChooseBy;
  weight: number;
  percent: number;
  rule: string;
  /** Past the five an A/B test may have: never shown by chance. */
  beyond: boolean;
  removable: boolean;
  onShow: () => void;
  onSelect: () => void;
  onWeight: (value: string) => void;
  onRemove: () => void;
};

/** One variant: which it is, what it is for, and the controls to see it, weigh it and take it out. */
const VariantRow = ({
  id,
  mark,
  shown,
  chooseBy,
  weight,
  percent,
  rule,
  beyond,
  removable,
  onShow,
  onSelect,
  onWeight,
  onRemove
}: RowProps) => (
  <li className="hover:bg-ui-hover flex items-center gap-2 rounded-md px-1.5 py-1">
    <button
      type="button"
      aria-pressed={shown}
      title={shown ? 'Shown in the canvas while editing' : 'Show this one in the canvas while editing'}
      className={clsx('flex size-6 shrink-0 items-center justify-center rounded transition-colors', {
        'bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300': shown,
        'text-ui-fg-subtle hover:text-ui-fg': !shown
      })}
      onClick={onShow}
    >
      <i className={clsx(shown ? 'fa-solid fa-eye' : 'fa-regular fa-eye', 'text-[11px]')} />
    </button>
    <span className="bg-ui-raised text-ui-fg-muted inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold">
      {mark}
    </span>
    <button
      type="button"
      className="min-w-0 grow text-left"
      title={chooseBy === 'rules' ? `Edit the rule of ${id}` : `Select ${id}`}
      onClick={onSelect}
    >
      <span className="text-ui-fg block truncate text-xs">{id}</span>
      {chooseBy === 'rules' && (
        <span className="text-ui-fg-subtle block truncate text-[10px]">{rule || 'Everyone else'}</span>
      )}
      {beyond && (
        <span className="block text-[10px] text-amber-600 dark:text-amber-400">Never shown: five at most</span>
      )}
    </button>
    {chooseBy === 'chance' && (
      <>
        <Input
          className="w-14 shrink-0"
          type="number"
          size="xs"
          min={0}
          max={100}
          aria-label={`Share of ${id}`}
          value={String(weight)}
          onChange={onWeight}
        />
        <span className="text-ui-fg-muted w-9 shrink-0 text-right text-[11px] tabular-nums">{percent}%</span>
      </>
    )}
    {chooseBy === 'rules' && (
      <button
        type="button"
        title={`Edit the rule of ${id}`}
        className="text-ui-fg-subtle hover:text-ui-fg flex size-6 shrink-0 items-center justify-center rounded"
        onClick={onSelect}
      >
        <i className="fa-solid fa-pen text-[10px]" />
      </button>
    )}
    <button
      type="button"
      title={removable ? `Remove ${id}` : 'It needs the variants it has'}
      disabled={!removable}
      className="text-ui-fg-subtle flex size-6 shrink-0 items-center justify-center rounded enabled:hover:text-red-600 disabled:opacity-40 dark:enabled:hover:text-red-400"
      onClick={onRemove}
    >
      <i className="fa-solid fa-trash text-[10px]" />
    </button>
  </li>
);

/**
 * A Variants element's settings: how it chooses, and its variants in a list — each with its share or its rule, the one
 * the canvas shows, and the way to add, select and remove one — so it is set from one place.
 */
const Settings = ({ id = '', chooseBy = 'chance', experiment = '', builderVariant = 0, onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);
  const [[items = [], rootId = '']] = useCommonStore([
    `schema.flat.${id}.definition.items`,
    `schema.flat.${id}.definition.rootId`
  ]);
  // The variants whole: a panel writes another element's attribute by handing the builder that element, changed —
  // `updateElement` writes only the one selected.
  const [variantElements] = useCommonStore(items.map(item => `schema.flat.${item}` as const));
  const [[routeParams = {}, queryParams = {}, visitorRoles]] = useCommonStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings.visitorRoles'
  ]);
  const [, setSelected] = useBuilderStore('elementSelected');
  const { builderHandler, builderDropElement } = use(BuilderContext);
  const { componentDefinitions } = use(ComponentContext);

  const fields = useMemo(
    () => audienceRuleFields({ routeParams, queryParams, visitorRoles: Object.keys(visitorRoles ?? {}) }),
    [routeParams, queryParams, visitorRoles]
  );
  const weights = items.map((_, index) => weightOf(variantElements[index]?.attributes));
  const counted = weights.slice(0, EXPERIMENT_VARIANTS.length);
  const total = counted.reduce((sum, weight) => sum + weight, 0);
  const rules = items.map((_, index) => variantElements[index]?.attributes.when);
  const fallback = rules.findIndex(when => !hasConditions(when));
  const fewest = chooseBy === 'chance' ? 2 : 1;
  const name = experimentNameOf({ id, attributes: { experiment } });
  const full = chooseBy === 'chance' && items.length >= EXPERIMENT_VARIANTS.length;

  const handleMode = useCallback((mode: ChooseBy) => onUpdate?.('chooseBy', mode), [onUpdate]);

  const writeWeight = useCallback(
    (index: number, weight: number) => {
      const variant = variantElements.at(index);
      if (variant) {
        builderHandler('schemaUpdateElement', { ...variant, attributes: { ...variant.attributes, weight } });
      }
    },
    [builderHandler, variantElements]
  );

  const handleEven = useCallback(() => {
    const share = Math.floor(100 / Math.max(1, Math.min(items.length, EXPERIMENT_VARIANTS.length)));
    items.forEach((_, index) => writeWeight(index, share));
  }, [items, writeWeight]);

  const handleAdd = useCallback(() => {
    const declared = componentDefinitions.current[VARIANT_ITEM_TYPE] as
      (typeof componentDefinitions.current)[string] | undefined;
    const last = items.at(-1);
    if (!declared || last === undefined) {
      return;
    }

    // By rules, a new variant goes before the one for everyone else, which would take its visitors; by chance, last.
    const before = chooseBy === 'rules' && fallback !== -1 ? items[fallback] : undefined;
    // No id: the document it is added to mints the name, as a drop from the elements panel does.
    const element = { id: '', ...pick(declared, ['attributes', 'definition']) };
    builderDropElement('add##variant', { element }, before ? 'top' : 'bottom', before ?? last, rootId);
  }, [builderDropElement, chooseBy, componentDefinitions, fallback, items, rootId]);

  const handleRemove = useCallback(
    (index: number) => {
      builderHandler('schemaRemoveElement', items[index]);
      if (index < builderVariant) {
        onUpdate?.('builderVariant', builderVariant - 1);
      } else if (index === builderVariant) {
        onUpdate?.('builderVariant', 0);
      }
    },
    [builderHandler, builderVariant, items, onUpdate]
  );

  const handleWeight = useCallback(
    (index: number, value: string) => {
      const share = Number(value);
      // A whole share, 0–100: what cannot be read as one is left as it was rather than written as 0, which would take
      // the variant out of the test.
      if (value.trim() !== '' && Number.isFinite(share)) {
        writeWeight(index, Math.min(100, Math.max(0, Math.round(share))));
      }
    },
    [writeWeight]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-fg text-xs font-medium">Choose the variant</span>
        <ModeSwitch chooseBy={chooseBy} onChange={handleMode} />
        <span className="text-ui-fg-subtle text-xs">{HOW[chooseBy]}</span>
      </div>
      {chooseBy === 'chance' && (
        <div className="flex flex-col gap-1">
          <Input
            label="Test name"
            size="xs"
            placeholder={experimentNameOf({ id, attributes: {} }) ?? 'heroTest'}
            value={experiment}
            onChange={update.text('experiment')}
          />
          <span className={clsx('text-xs', name ? 'text-ui-fg-subtle' : 'text-red-600 dark:text-red-400')}>
            {name === undefined
              ? 'Not running: a name is letters, digits and _, not starting with a digit — heroTest, pricing_v2.'
              : `${experiment === '' ? 'Named after this element until you name it. ' : ''}Its results are in Analytics → Experiments as “${name}”.`}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wide uppercase">Each variant</span>
          {chooseBy === 'chance' && items.length > 1 && (
            <button type="button" className="text-primary-600 dark:text-primary-300 text-[11px]" onClick={handleEven}>
              Even shares
            </button>
          )}
        </div>
        <ul className="flex flex-col">
          {items.map((item, index) => (
            <VariantRow
              key={item}
              id={item}
              mark={chooseBy === 'chance' ? (variantAt(index)?.toUpperCase() ?? '–') : String(index + 1)}
              shown={index === builderVariant}
              chooseBy={chooseBy}
              weight={weights[index]}
              percent={index < EXPERIMENT_VARIANTS.length ? percentOf(weights[index], total) : 0}
              rule={ruleSummary(rules[index], fields)}
              beyond={chooseBy === 'chance' && index >= EXPERIMENT_VARIANTS.length}
              removable={items.length > fewest}
              onShow={() => onUpdate?.('builderVariant', index)}
              onSelect={() => setSelected(item)}
              onWeight={value => handleWeight(index, value)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </ul>
        <Button size="xs" intent="secondary" className="self-start" disabled={full} onClick={handleAdd}>
          <Button.Icon icon="fa-solid fa-plus" />
          Add a variant
        </Button>
      </div>
      <span className="text-ui-fg-subtle text-xs">
        {chooseBy === 'chance'
          ? 'A share is out of the total: 90 and 10 show the first to 90% of the visitors. 0 shows a variant to nobody. The eye picks the one the canvas shows while editing; its preview shows the visitor chosen in State Manager → Visitor.'
          : 'Select a variant to write its rule: what the visitor’s device, language, first visit or address say. The eye picks the one the canvas shows while editing; its preview shows the visitor chosen in State Manager → Visitor.'}
      </span>
    </div>
  );
};

export default Settings;
