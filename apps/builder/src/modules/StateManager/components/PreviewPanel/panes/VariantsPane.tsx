import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { audienceRuleFields, ruleSummary } from '@plitzi/sdk-elements/builder';
import { useAudienceScope } from '@plitzi/sdk-elements/dataSource';
import { chooseAudienceVariant } from '@plitzi/sdk-shared/audiences';
import {
  EXPERIMENT_VARIANTS,
  experimentNameOf,
  variantAt,
  weightOf,
  withForcedExperiment
} from '@plitzi/sdk-shared/experiments';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chooseByOf, variantItemsOf, variantsElementsOf } from '@plitzi/sdk-shared/variants';

import type { Element } from '@plitzi/sdk-shared';
import type { ExperimentAssignments, ExperimentVariant } from '@plitzi/sdk-shared/experiments';

const NONE: ExperimentAssignments = {};

type ChanceProps = { element: Element; variants: Element[]; forced: ExperimentAssignments };

/**
 * A Variants element by chance: the variant the preview's visitor is given, picked here — or, until one is, the one its
 * settings show — each with the share of the visitors it is drawn for.
 */
const ChanceCard = ({ element, variants, forced }: ChanceProps) => {
  const [, setForced] = useBuilderStore('experiments.qa');
  const name = experimentNameOf(element);
  const counted = variants.slice(0, EXPERIMENT_VARIANTS.length);
  const weights = counted.map(weightOf);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const picked = name === undefined ? undefined : forced[name];

  const pick = useCallback(
    (variant: ExperimentVariant | undefined) => {
      if (name !== undefined) {
        setForced(withForcedExperiment(forced, name, variant));
      }
    },
    [forced, name, setForced]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label={`The variant of ${element.id} this visitor is given`}
        className="flex flex-wrap gap-1"
      >
        <button
          type="button"
          role="radio"
          aria-checked={picked === undefined}
          title="As the element's settings show it"
          className={clsx('rounded-md border px-2 py-1 text-[11px]', {
            'border-primary-400/60 bg-primary-400/10 text-primary-text': picked === undefined,
            'border-ui-line text-ui-fg-muted hover:bg-ui-hover': picked !== undefined
          })}
          onClick={() => pick(undefined)}
        >
          As its settings
        </button>
        {counted.map((variant, index) => {
          const letter = variantAt(index);
          if (!letter) {
            return null;
          }

          const share = total > 0 ? Math.round((weights[index] / total) * 100) : 0;

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={picked === letter}
              title={`${variant.id} — drawn for ${String(share)}% of the visitors`}
              className={clsx('flex items-baseline gap-1 rounded-md border px-2 py-1 text-[11px]', {
                'border-primary-400/60 bg-primary-400/10 text-primary-text': picked === letter,
                'border-ui-line text-ui-fg hover:bg-ui-hover': picked !== letter
              })}
              onClick={() => pick(letter)}
            >
              <span className="font-semibold">{letter.toUpperCase()}</span>
              <span className="text-ui-fg-subtle tabular-nums">{share}%</span>
            </button>
          );
        })}
      </div>
      {name === undefined && (
        <span className="text-[11px] text-red-600 dark:text-red-400">
          Its test name cannot be read: it runs nothing.
        </span>
      )}
    </div>
  );
};

type RulesProps = { variants: Element[]; matched: number };

/** A Variants element by rules: every variant with its rule, the one this visitor matches lit — the first that does. */
const RulesCard = ({ variants, matched }: RulesProps) => {
  const [[routeParams = {}, queryParams = {}, visitorRoles]] = useBuilderStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings.visitorRoles'
  ]);
  const fields = useMemo(
    () => audienceRuleFields({ routeParams, queryParams, visitorRoles: Object.keys(visitorRoles ?? {}) }),
    [routeParams, queryParams, visitorRoles]
  );

  return (
    <ol className="flex flex-col gap-0.5">
      {variants.map((variant, index) => {
        const shown = index === matched;

        return (
          <li
            key={variant.id}
            className={clsx('flex items-start gap-2 rounded-md px-2 py-1', {
              'bg-primary-400/10': shown
            })}
          >
            <span
              className={clsx(
                'mt-px inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold',
                {
                  'bg-primary-500 text-white': shown,
                  'bg-ui-raised text-ui-fg-subtle': !shown
                }
              )}
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 grow flex-col">
              <span className={clsx('truncate text-[11px]', shown ? 'text-ui-fg font-medium' : 'text-ui-fg-muted')}>
                {variant.id}
              </span>
              <span className="text-ui-fg-subtle truncate text-[10px]">
                {ruleSummary(variant.attributes.when, fields) || 'Everyone else'}
              </span>
            </span>
            {shown && <span className="text-primary-text shrink-0 text-[10px] font-semibold">This visitor</span>}
          </li>
        );
      })}
      {matched === -1 && (
        <li className="text-ui-fg-subtle px-2 text-[11px]">No variant is for this visitor: nothing is shown.</li>
      )}
    </ol>
  );
};

/**
 * Every Variants element of the page the canvas shows — and of the space's components — and what the preview's
 * visitor sees of each: by chance the variant picked here; by rules the one their facts match, which the Visitor and
 * Address tabs change.
 */
const VariantsPane = () => {
  const [[flat, components, currentPageId]] = useBuilderStore([
    'schema.flat',
    'schema.components',
    'navigation.currentPageId'
  ]);
  const [forced = NONE] = useBuilderStore('experiments.qa');
  const scope = useAudienceScope();
  const elements = useMemo(
    () =>
      variantsElementsOf({ flat, components }).filter(
        ({ element, flat: tree }) => tree !== flat || element.definition.rootId === currentPageId
      ),
    [components, currentPageId, flat]
  );

  if (elements.length === 0) {
    return (
      <p className="text-ui-fg-subtle px-1 text-[11px]">
        This page has no Variants element. Drop one from Elements → Testing to try its variants here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {elements.map(({ element, flat: tree }) => {
        const variants = variantItemsOf(element, tree);
        const byRules = chooseByOf(element.attributes) === 'rules';
        const matched = byRules
          ? chooseAudienceVariant(
              variants.map(variant => variant.attributes.when),
              scope
            )
          : -1;

        return (
          <section key={element.id} className="border-ui-line flex flex-col gap-2 rounded-lg border p-2.5">
            <header className="flex items-center gap-2">
              <i
                className={clsx(
                  byRules ? 'fa-solid fa-filter' : 'fa-solid fa-shuffle',
                  'text-ui-fg-subtle text-[10px]'
                )}
              />
              <span className="text-ui-fg min-w-0 grow truncate font-mono text-xs">{element.id}</span>
              <span className="text-ui-fg-subtle shrink-0 text-[10px]">{byRules ? 'By rules' : 'By chance'}</span>
            </header>
            {byRules ? (
              <RulesCard variants={variants} matched={matched} />
            ) : (
              <ChanceCard element={element} variants={variants} forced={forced} />
            )}
          </section>
        );
      })}
    </div>
  );
};

export default VariantsPane;
