import { RootElement } from '@plitzi/plitzi-sdk';
import { useMemo, useState } from 'react';

/**
 * The conservation status of the animal an article is about.
 *
 * **Why this is a plugin and not four containers.** A Red List category is a POSITION on a scale and a trend is a
 * SHAPE: neither can be arranged out of headings and paragraphs, and faking them with a row of divs gives you a
 * picture that cannot be read by anybody using a screen reader and cannot be clicked. That is the line — a space
 * ships an element of its own when the thing it wants to show is not text in a box.
 *
 * **It is an element like any other.** Its attributes arrive as props, so the page binds them to the same server
 * action everything else on the post page reads; it takes no data of its own and makes no request. The BOX around
 * it belongs to whoever placed it — the space names a class, exactly as it does for a heading — and the parts
 * inside carry `species__*` names of their own, which is the only contract this file has with the stylesheet.
 *
 * It ships **no colours**: every rule is written in the space's own variables, which is what lets it follow the
 * blog into dark mode without knowing that dark mode exists.
 */

export type SpeciesStatusProps = {
  name?: string;
  latin?: string;
  status?: string;
  trend?: string;
  /** A population index, oldest first. Arrives as an array from a binding and as text from the builder. */
  history?: number[] | string;
  since?: number | string;
  note?: string;
};

/** The five categories the IUCN uses for a species that is still with us, in order of how much trouble it is in. */
const SCALE = [
  { code: 'LC', label: 'Least Concern', meaning: 'Assessed, and not currently at risk of extinction.' },
  { code: 'NT', label: 'Near Threatened', meaning: 'Close to qualifying for a threatened category, or likely to.' },
  { code: 'VU', label: 'Vulnerable', meaning: 'A high risk of extinction in the wild.' },
  { code: 'EN', label: 'Endangered', meaning: 'A very high risk of extinction in the wild.' },
  { code: 'CR', label: 'Critically Endangered', meaning: 'An extremely high risk of extinction in the wild.' }
] as const;

const TREND: Record<string, { arrow: string; label: string }> = {
  increasing: { arrow: 'M2 12 L8 5 L14 12', label: 'Population increasing' },
  decreasing: { arrow: 'M2 5 L8 12 L14 5', label: 'Population decreasing' },
  stable: { arrow: 'M2 8.5 L14 8.5', label: 'Population stable' },
  unknown: { arrow: 'M2 8.5 L5 8.5 M8 8.5 L11 8.5', label: 'Population trend unknown' }
};

/** A binding hands over the array; a value typed into the builder arrives as text. Both have to work. */
const toSeries = (history: number[] | string | undefined): number[] => {
  if (Array.isArray(history)) {
    return history.filter(value => Number.isFinite(value));
  }

  if (typeof history !== 'string' || !history.trim()) {
    return [];
  }

  return history
    .replace(/[[\]]/g, '')
    .split(',')
    .map(part => Number.parseFloat(part.trim()))
    .filter(value => Number.isFinite(value));
};

/** The series as one `points` string, scaled into the box the chart is drawn in. */
const polyline = (series: number[], width: number, height: number): string => {
  const top = Math.max(...series);
  const bottom = Math.min(...series);
  const span = top - bottom || 1;
  const step = series.length > 1 ? width / (series.length - 1) : 0;

  return series.map((value, index) => `${index * step},${height - ((value - bottom) / span) * height}`).join(' ');
};

const SpeciesStatus = ({
  name = '',
  latin = '',
  status = 'LC',
  trend = 'unknown',
  history,
  since = 1970,
  note = ''
}: SpeciesStatusProps) => {
  /**
   * Which category the panel is explaining — the species' own until somebody asks about another.
   *
   * The interactive half, and the reason it is worth having: a five-letter code is only information to somebody
   * who already knows the scale. Anyone else can now press one and be told.
   */
  const [asked, setAsked] = useState<string | null>(null);
  const shown = asked ?? status;
  const explained = SCALE.find(entry => entry.code === shown) ?? SCALE[0];
  const current = SCALE.findIndex(entry => entry.code === status);

  const series = useMemo(() => toSeries(history), [history]);
  const change = series.length > 1 ? Math.round(((series[series.length - 1] - series[0]) / series[0]) * 100) : 0;
  const arrow = TREND[trend] ?? TREND.unknown;

  return (
    <RootElement tag="aside">
      <div className="species__head">
        <div>
          <div className="species__name">{name}</div>
          <div className="species__latin">{latin}</div>
        </div>
        <div className="species__trend" title={arrow.label}>
          <svg viewBox="0 0 16 17" width="16" height="17" fill="none" aria-hidden>
            <path d={arrow.arrow} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {series.length > 1 && <span>{change > 0 ? `+${change}%` : `${change}%`}</span>}
        </div>
      </div>

      {/*
        Say what the row IS before showing it.
        
        Without this caption the five buttons read as a filter — press one and expect the chart below to answer —
        and the chart is a different fact entirely: the population over time, which does not depend on which
        category you are asking about. One line removes the whole misunderstanding.
      */}
      <div className="species__legend">Red List category — press one to see what it means</div>
      <div className="species__scale" role="group" aria-label="IUCN Red List category">
        {SCALE.map((entry, index) => (
          <button
            key={entry.code}
            type="button"
            className="species__step"
            data-state={entry.code === status ? 'current' : index < current ? 'below' : 'above'}
            // Only once somebody has actually asked. On first paint the current step is already the one being
            // explained, and ringing it as well is a marker for a question nobody put.
            data-asked={asked === entry.code ? 'true' : undefined}
            aria-pressed={entry.code === shown}
            title={entry.label}
            onClick={() => setAsked(entry.code)}
          >
            {entry.code}
          </button>
        ))}
      </div>

      <p className="species__meaning">
        <strong>{explained.label}</strong> — {explained.meaning}
        {/* Asked about a category that is not this animal's: say whose it is, so the panel never reads as if the
            species had just changed. */}
        {asked && asked !== status && (
          <span className="species__aside">
            {' '}
            {name} is listed {SCALE[current]?.label ?? status}.
          </span>
        )}
      </p>

      {series.length > 1 && (
        <div className="species__chart">
          <div className="species__legend">Population, indexed to {since} = 100</div>
          <svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden>
            {/* Drawn twice: a soft fill under the line, then the line, so it reads at 34 pixels tall. */}
            <polygon points={`0,34 ${polyline(series, 100, 30)} 100,34`} fill="url(#speciesFade)" opacity="0.35" />
            <polyline
              points={polyline(series, 100, 30)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <defs>
              <linearGradient id="speciesFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="species__axis">
            <span>{since}</span>
            <span>now</span>
          </div>
        </div>
      )}

      {note && <p className="species__note">{note}</p>}
    </RootElement>
  );
};

export default SpeciesStatus;
