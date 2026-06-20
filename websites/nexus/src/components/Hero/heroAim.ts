// Vectorial lead targeting. Given a shooter, a moving target and a projectile speed, solves for the point where a shot
// fired now will actually meet the target — so the AI hits enemies in motion instead of aiming where they used to be.
// |T + V·t − S| = speed·t expands to a quadratic in t; we take the smallest positive root and project the target there.
export const leadPoint = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  tvx: number,
  tvy: number,
  speed: number
): { x: number; y: number } => {
  const rx = tx - sx;
  const ry = ty - sy;
  const a = tvx * tvx + tvy * tvy - speed * speed;
  const b = 2 * (rx * tvx + ry * tvy);
  const c = rx * rx + ry * ry;

  let t = 0;
  if (Math.abs(a) < 1e-6) {
    // Target and projectile speeds match: linear case.
    if (Math.abs(b) > 1e-6) {
      t = -c / b;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      // Smallest strictly-positive root is the soonest intercept.
      const positives = [t1, t2].filter(v => v > 0);
      if (positives.length) {
        t = Math.min(...positives);
      }
    }
  }

  if (t <= 0 || !Number.isFinite(t)) {
    return { x: tx, y: ty };
  }

  return { x: tx + tvx * t, y: ty + tvy * t };
};
