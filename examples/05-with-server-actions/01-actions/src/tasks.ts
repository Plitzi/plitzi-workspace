import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * A task this deployment adds to the ones `sdk-server` ships.
 *
 * The second of the two extension points a self-hosted deployment owns — the other being its own triggers. It
 * shows up in the builder's step catalog with no fork of anything, because that catalog is SERVED by this server
 * rather than compiled into the editor: what a space can do server-side is decided here.
 *
 * Params are declared the way an interaction callback declares them, so the editor can offer the same bindings.
 */

/** Twig hands back a lone token with its own type and an embedded one as text, so a numeric param arrives either
 *  way. Every built-in task that takes a number does this. */
const toNumber = (value: string | number, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const DISTANCE_BANDS: Record<string, number> = { berlin: 1, madrid: 2, tokyo: 4 };

export const shippingRate: ActionTask<{ city: string; weightKg: string | number; ratePerKg: string | number }> = {
  namespace: 'example',
  action: 'shippingRate',
  title: 'Shipping Rate',
  description: 'Prices a parcel from a destination and a weight.',
  params: {
    city: { type: 'text', canBind: true, defaultValue: '', label: 'Destination city' },
    weightKg: { type: 'text', canBind: true, defaultValue: '1', label: 'Weight (kg)' },
    ratePerKg: { type: 'text', canBind: true, defaultValue: '4', label: 'Rate per kg' }
  },
  run: ({ city, weightKg, ratePerKg }) => {
    const band = DISTANCE_BANDS[city.trim().toLowerCase()] ?? 3;
    const total = Math.round(band * toNumber(weightKg, 1) * toNumber(ratePerKg, 4) * 100) / 100;

    // Whatever a task returns lands in the flow scope under its own node id, and nothing else does. That is the
    // whole of what a later step can address — including the output step, which is what reaches the browser.
    return { city, band, total, currency: 'EUR' };
  }
};
