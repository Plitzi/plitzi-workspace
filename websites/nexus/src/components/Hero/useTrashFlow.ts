import { type RefObject, useEffect } from 'react';

import { getGameContext, sizeCanvas } from './heroCanvas';
import { keyAxisX, keyAxisY } from './heroKeys';
import { isPaused } from './heroPause';
import { minFrameMs } from './heroPerf';
import { resumeAudio, sfx } from './heroSfx';
import {
  type StatKey,
  type TrashPatch,
  type TrashStats,
  advanceRefund,
  airPull,
  batterySeconds,
  drainMultiplier,
  levelTarget,
  pipeCapacity,
  suctionRadius,
  upgradeCost,
  valuePerScrap
} from './trashFlowStore';
import { isHeroVisible } from './heroVisibility';

import type { EntityStore } from '@plitzi/nexus';

export type Scrap = { id: string; x: number; y: number; hue: number; sides: number; size: number; rot: number };

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

export type TrashFlowApi = {
  buy: (key: StatKey) => boolean;
  toShop: () => void;
  newRun: () => void;
};

// A confetti world far larger than the viewport so it always feels enormous; early levels are zoomed in on a corner of
// it and each level zooms OUT to reveal more, while the camera pans slowly whenever the vacuum drifts toward an edge.
const WORLD_W = 4200;
const WORLD_H = 2800;
const LEVEL_CAP = 10;

// The camera eases toward its target instead of snapping — a slow, weighty pan that sells the scale of the map.
const CAM_EASE = 0.045;

// The vacuum FOLLOWS the cursor, but with momentum (the Asteroids feel): it accelerates toward the cursor, drifts under
// inertia and overshoots before settling, so it is clearly a heavy body trailing the mouse rather than the mouse itself.
// Speed is kept deliberately low — the vacuum should drift lazily, never keep up with a flicked mouse.
const FOLLOW_ACCEL = 0.28;
const FRICTION = 0.91;
const MAX_SPEED = 3;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Zoom shrinks each level (more of the world on screen). Level 1 starts fairly wide and the curve eases out smoothly
// across all ten levels (≈0.9 → ≈0.42) without slamming into the floor early, so each level reveals a little more map.
const scaleOf = (level: number) => Math.max(0.42, 0.9 * 0.92 ** (level - 1));

const useTrashFlow = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  store: EntityStore<Scrap>,
  publish: (patch: TrashPatch) => void,
  apiRef: RefObject<TrashFlowApi | null>
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = getGameContext(canvas);
    if (!ctx) {
      return;
    }

    let viewW = 0;
    let viewH = 0;
    let raf = 0;
    let idleTimer = 0;
    let lastFrame = 0;
    let lastNow = performance.now();
    let nextId = 0;
    let publishAt = 0;

    const scraps: Scrap[] = [];
    const particles: Particle[] = [];
    const updates: { id: string; changes: Partial<Scrap> }[] = [];
    const pointer = { x: 0, y: 0, active: false };
    const cursor = { x: 0, y: 0 };
    const vac = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0 };
    const cam = { x: 0, y: 0 };
    const camTarget = { x: 0, y: 0 };
    // True only while the player is actually steering (mouse or keys); the bright cursor is hidden during autopilot.
    let manualInput = false;
    const stats: TrashStats = { battery: 1, pipe: 1, air: 1, radius: 1, value: 1 };
    const game = {
      points: 0,
      level: 1,
      levelEarned: 0,
      cleared: false,
      target: levelTarget(1),
      batteryMs: 0,
      batteryMax: 1,
      phase: 'playing' as 'playing' | 'summary' | 'shop',
      run: 0,
      runPoints: 0,
      runCollected: 0,
      runSpawned: 0,
      allTimePoints: 0
    };

    const value = () => valuePerScrap(stats.value);

    const makeScrap = (): Scrap => ({
      id: `s${nextId++}`,
      x: rand(0, WORLD_W),
      y: rand(0, WORLD_H),
      hue: Math.floor(rand(0, 360)),
      sides: Math.floor(rand(3, 7)),
      size: rand(7, 13),
      rot: rand(0, Math.PI * 2)
    });

    const fieldCount = () => Math.min(1800, 640 + game.level * 150);

    const spawnField = () => {
      scraps.length = 0;
      const count = fieldCount();
      for (let i = 0; i < count; i += 1) {
        scraps.push(makeScrap());
      }

      game.runSpawned += count;
      store.setAll(scraps);
    };

    // Tops the field back up to the current level's density (used when a level is cleared mid-round).
    const refillField = () => {
      const target = fieldCount();
      const added: Scrap[] = [];
      while (scraps.length < target) {
        const s = makeScrap();
        scraps.push(s);
        added.push(s);
      }

      if (added.length) {
        game.runSpawned += added.length;
        store.addMany(added);
      }
    };

    const pushHud = () => {
      publish({
        points: game.points,
        value: value(),
        level: game.level,
        levelPct: Math.min(100, Math.round((game.levelEarned / game.target) * 100)),
        cleared: game.cleared,
        remaining: scraps.length,
        batteryPct: Math.max(0, Math.round((game.batteryMs / game.batteryMax) * 100)),
        phase: game.phase,
        run: game.run,
        runPoints: game.runPoints,
        runCollected: game.runCollected,
        runCleanedPct: game.runSpawned ? Math.min(100, Math.round((game.runCollected / game.runSpawned) * 100)) : 0,
        allTimePoints: game.allTimePoints
      });
    };

    // A round always starts at level 1 on a fresh battery; upgrades carry over from the shop. Better upgrades let you
    // climb further (toward level 10) before the battery runs out.
    const startRound = () => {
      game.phase = 'playing';
      game.run += 1;
      game.level = 1;
      game.levelEarned = 0;
      game.cleared = false;
      game.target = levelTarget(1);
      game.batteryMax = batterySeconds(stats.battery) * 1000;
      game.batteryMs = game.batteryMax;
      game.runPoints = 0;
      game.runCollected = 0;
      game.runSpawned = 0;
      vac.x = WORLD_W / 2;
      vac.y = WORLD_H / 2;
      vac.vx = 0;
      vac.vy = 0;
      spawnField();
      pushHud();
      wake();
    };

    // The run is over: freeze play and show the results card. Battery-out keeps `cleared` false; clearing level 10 sets
    // it true so the summary reads "run complete" instead of "battery dead".
    const endRun = () => {
      game.phase = 'summary';
      sfx.power();
      pushHud();
    };

    // Clearing a level's target mid-round bumps the level, tops up the field and refunds a slice of battery — but the
    // refund shrinks every level (advanceRefund) and the drain speeds up, so each level is harder than the last.
    const advanceLevel = () => {
      if (game.level >= LEVEL_CAP) {
        game.cleared = true;
        endRun();

        return;
      }

      game.level += 1;
      game.levelEarned = 0;
      game.target = levelTarget(game.level);
      game.batteryMs = Math.min(game.batteryMax, game.batteryMs + game.batteryMax * advanceRefund(game.level));
      refillField();
      sfx.power();
      pushHud();
    };

    apiRef.current = {
      buy: (key: StatKey) => {
        if (game.phase !== 'shop') {
          return false;
        }

        const cost = upgradeCost(key, stats[key]);
        if (game.points < cost) {
          return false;
        }

        game.points -= cost;
        stats[key] += 1;
        publish({ points: game.points, value: value(), stats: { ...stats } });
        sfx.power();

        return true;
      },
      toShop: () => {
        if (game.phase !== 'summary') {
          return;
        }

        game.phase = 'shop';
        pushHud();
      },
      newRun: startRound
    };

    const burst = (x: number, y: number, hue: number) => {
      for (let i = 0; i < 5; i += 1) {
        const a = rand(0, Math.PI * 2);
        const s = rand(0.6, 2.4);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const update = (now: number) => {
      const dt = Math.min(60, now - lastNow);
      lastNow = now;

      if (game.phase !== 'playing') {
        return;
      }

      const sc = scaleOf(game.level);
      const visW = viewW / sc;
      const visH = viewH / sc;

      // The cursor is the input point on screen (mouse, a keyboard-driven virtual cursor, or an attract-mode drift to
      // the nearest scrap). It is rendered as a bright point; the vacuum is NOT the cursor — it follows it with momentum.
      const kx = keyAxisX();
      const ky = keyAxisY();
      manualInput = pointer.active || kx !== 0 || ky !== 0;
      if (kx !== 0 || ky !== 0) {
        cursor.x += kx * 5;
        cursor.y += ky * 5;
      } else if (pointer.active) {
        cursor.x = pointer.x;
        cursor.y = pointer.y;
      } else {
        let nx = vac.x;
        let ny = vac.y;
        let best = Infinity;
        for (const s of scraps) {
          const d = (s.x - vac.x) ** 2 + (s.y - vac.y) ** 2;
          if (d < best) {
            best = d;
            nx = s.x;
            ny = s.y;
          }
        }

        cursor.x += ((nx - cam.x) * sc - cursor.x) * 0.04;
        cursor.y += ((ny - cam.y) * sc - cursor.y) * 0.04;
      }

      cursor.x = Math.max(0, Math.min(viewW, cursor.x));
      cursor.y = Math.max(0, Math.min(viewH, cursor.y));

      // Momentum follow (the Asteroids feel): accelerate toward the cursor, apply friction and a speed cap, then move by
      // the velocity. The inertia means the vacuum lags, drifts and overshoots before settling onto the cursor. The cap
      // and accel are divided by the zoom so the ON-SCREEN speed stays the same calm pace at every level — deeper levels
      // zoom out, and without this the vacuum would feel like it sped up and become unplayable.
      const maxSpeed = MAX_SPEED / sc;
      const tgtX = cam.x + cursor.x / sc;
      const tgtY = cam.y + cursor.y / sc;
      const ax = tgtX - vac.x;
      const ay = tgtY - vac.y;
      const dist = Math.hypot(ax, ay) || 0.001;
      const accel = Math.min(dist, FOLLOW_ACCEL / sc);
      vac.vx += (ax / dist) * accel;
      vac.vy += (ay / dist) * accel;
      vac.vx *= FRICTION;
      vac.vy *= FRICTION;
      const speed = Math.hypot(vac.vx, vac.vy);
      if (speed > maxSpeed) {
        vac.vx = (vac.vx / speed) * maxSpeed;
        vac.vy = (vac.vy / speed) * maxSpeed;
      }

      vac.x = Math.max(0, Math.min(WORLD_W, vac.x + vac.vx));
      vac.y = Math.max(0, Math.min(WORLD_H, vac.y + vac.vy));

      // Deadzone camera: a target is set only when the vacuum pushes past a central box, then the camera EASES toward
      // it — a slow, heavy pan across the huge world rather than an instant snap.
      const vsx = (vac.x - cam.x) * sc;
      const vsy = (vac.y - cam.y) * sc;
      const dzx = viewW * 0.24;
      const dzy = viewH * 0.24;
      const cx = viewW / 2;
      const cy = viewH / 2;
      if (vsx < cx - dzx) {
        camTarget.x -= (cx - dzx - vsx) / sc;
      } else if (vsx > cx + dzx) {
        camTarget.x += (vsx - (cx + dzx)) / sc;
      }

      if (vsy < cy - dzy) {
        camTarget.y -= (cy - dzy - vsy) / sc;
      } else if (vsy > cy + dzy) {
        camTarget.y += (vsy - (cy + dzy)) / sc;
      }

      camTarget.x = Math.max(0, Math.min(Math.max(0, WORLD_W - visW), camTarget.x));
      camTarget.y = Math.max(0, Math.min(Math.max(0, WORLD_H - visH), camTarget.y));
      cam.x += (camTarget.x - cam.x) * CAM_EASE;
      cam.y += (camTarget.y - cam.y) * CAM_EASE;

      // Two-stage suction, tuned to feel like a real vacuum rather than a whirlpool. In the FIRST (outer) ring a scrap
      // only just begins to drag — a barely-there inward drift with almost no curve. Once it crosses the SECOND (inner)
      // ring it is properly aspirated: the pull ramps up sharply and it accelerates toward the nozzle with a slight
      // curve, vanishing at the core. Up to `pipe` scraps handled at once.
      const outerR = suctionRadius(stats.radius);
      const innerR = Math.max(16, outerR * 0.3);
      const absorbR = innerR * 0.55;
      const pull = airPull(stats.air);
      const pipe = pipeCapacity(stats.pipe);
      let active = 0;
      const removed: string[] = [];
      updates.length = 0;
      for (let i = scraps.length - 1; i >= 0; i -= 1) {
        const s = scraps[i];
        const dx = s.x - vac.x;
        const dy = s.y - vac.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < outerR && active < pipe) {
          active += 1;
          const ang = Math.atan2(dy, dx);
          let nd: number;
          let swirl: number;
          if (d > innerR) {
            // First ring: subtle drag. Distant scraps barely creep inward, with the faintest curve.
            nd = d - Math.max(0.3, d * pull * 0.18);
            swirl = 0.012;
          } else {
            // Second ring: real aspiration. Pull ramps up toward the nozzle, with a gentle curve.
            const closeness = 1 - d / innerR;
            nd = d * (1 - pull * (0.9 + 1.3 * closeness));
            swirl = 0.03 + 0.1 * closeness;
          }

          if (nd < absorbR) {
            const v = value();
            game.points += v;
            game.levelEarned += v;
            game.runPoints += v;
            game.allTimePoints += v;
            game.runCollected += 1;
            burst(s.x, s.y, s.hue);
            removed.push(s.id);
            scraps.splice(i, 1);
          } else {
            s.x = vac.x + Math.cos(ang + swirl) * nd;
            s.y = vac.y + Math.sin(ang + swirl) * nd;
            updates.push({ id: s.id, changes: { x: s.x, y: s.y } });
          }
        }
      }

      // Hitting the level's target climbs to the next level mid-run (capped at 10) — better upgrades mean more levels per
      // run before the battery dies.
      if (game.levelEarned >= game.target) {
        advanceLevel();
        if (game.phase !== 'playing') {
          return;
        }
      }

      if (removed.length) {
        store.removeMany(removed);
        sfx.hit();
      }

      if (updates.length) {
        store.updateMany(updates);
      }

      // Battery drains the run clock, faster on deeper levels; empty → the run ends and the results card shows.
      game.batteryMs -= dt * drainMultiplier(game.level);
      if (game.batteryMs <= 0) {
        game.batteryMs = 0;
        endRun();

        return;
      }

      if (now > publishAt) {
        publishAt = now + 150;
        pushHud();
      }
    };

    const polygon = (x: number, y: number, r: number, sides: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i += 1) {
        const a = rot + (i / sides) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.closePath();
      ctx.fill();
    };

    // The loop only runs the rAF (and touches the GPU) while you're actually playing. When paused, scrolled off screen,
    // or sitting on the run-summary / shop UI, there is nothing to animate — so it drops to a low-frequency timer poll
    // instead of a 60fps spin, and resumes the moment play returns.
    const shouldRun = () => !isPaused() && isHeroVisible() && game.phase === 'playing';

    const wake = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
        lastNow = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };

    const draw = (now: number) => {
      if (!shouldRun()) {
        lastNow = performance.now();
        idleTimer = window.setTimeout(() => {
          idleTimer = 0;
          raf = requestAnimationFrame(draw);
        }, 200);

        return;
      }

      raf = requestAnimationFrame(draw);
      update(now);

      if (now - lastFrame < minFrameMs()) {
        return;
      }

      lastFrame = now;
      const sc = scaleOf(game.level);
      ctx.clearRect(0, 0, viewW, viewH);

      // Confetti scraps, culled to the viewport.
      for (const s of scraps) {
        const sx = (s.x - cam.x) * sc;
        const sy = (s.y - cam.y) * sc;
        if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) {
          continue;
        }

        ctx.fillStyle = `hsl(${s.hue}, 75%, 62%)`;
        polygon(sx, sy, s.size * sc, s.sides, s.rot);
      }

      const vsx = (vac.x - cam.x) * sc;
      const vsy = (vac.y - cam.y) * sc;
      const outer = suctionRadius(stats.radius) * sc;
      const inner = Math.max(16, suctionRadius(stats.radius) * 0.3) * sc;
      const t = now / 1000;
      // The dials spin faster and the field glows brighter the more Air Speed you have, so a stronger vacuum visibly
      // pulls harder; the inner ring shows one intake dot per unit of Pipe Size (how many scraps it can draw at once).
      const airPower = Math.min(1, (stats.air - 1) / 8);

      // Soft field glow within the suction radius, deepening toward the centre and intensifying with Air Speed.
      const field = ctx.createRadialGradient(vsx, vsy, inner * 0.4, vsx, vsy, outer);
      field.addColorStop(0, `rgba(96, 165, 250, ${(0.14 + 0.16 * airPower).toFixed(3)})`);
      field.addColorStop(0.55, `rgba(59, 130, 246, ${(0.07 + 0.1 * airPower).toFixed(3)})`);
      field.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.arc(vsx, vsy, outer, 0, Math.PI * 2);
      ctx.fill();

      // Suction pulses: faint rings that contract from the outer ring toward the nozzle, selling the inward pull. They
      // sweep faster the more Air Speed you have.
      const pulseSpeed = 0.45 + airPower * 0.6;
      for (let p = 0; p < 3; p += 1) {
        const phase = (t * pulseSpeed + p / 3) % 1;
        const r = inner + (1 - phase) * (outer - inner);
        const alpha = Math.sin(phase * Math.PI) * (0.16 + 0.14 * airPower);
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(vsx, vsy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Outer ring: a rotating instrument dial — alternating long/short radial ticks on a faint base circle. Spins
      // faster with Air Speed.
      ctx.save();
      ctx.translate(vsx, vsy);
      ctx.rotate(t * (0.3 + airPower * 0.45));
      ctx.strokeStyle = `rgba(96, 165, 250, ${(0.18 + 0.14 * airPower).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, outer, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(147, 197, 253, ${(0.45 + 0.3 * airPower).toFixed(3)})`;
      const ticks = 48;
      for (let i = 0; i < ticks; i += 1) {
        const a = (i / ticks) * Math.PI * 2;
        const len = i % 4 === 0 ? 8 : 4;
        ctx.lineWidth = i % 4 === 0 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (outer - len), Math.sin(a) * (outer - len));
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }

      ctx.restore();

      // Inner ring: the aspiration threshold, counter-rotating (faster with Air Speed) with a soft glow and one bright
      // intake port per unit of Pipe Size.
      ctx.save();
      ctx.translate(vsx, vsy);
      ctx.rotate(-t * (0.7 + airPower * 0.8));
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(125, 211, 252, 0.8)';
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, inner, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.95)';
      const intakes = Math.min(16, pipeCapacity(stats.pipe));
      for (let i = 0; i < intakes; i += 1) {
        const a = (i / intakes) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * inner, Math.sin(a) * inner, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Glossy orb core: an off-centre radial gradient gives it a 3D sphere look, with a halo and a slowly drifting
      // specular highlight. Its glow swells with Air Speed.
      const coreR = 15;
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(vsx, vsy, coreR + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 18 + 16 * airPower;
      ctx.shadowColor = '#3b82f6';
      const orb = ctx.createRadialGradient(vsx - 4, vsy - 4, 1, vsx, vsy, coreR);
      orb.addColorStop(0, '#ffffff');
      orb.addColorStop(0.3, '#dbeafe');
      orb.addColorStop(0.62, '#60a5fa');
      orb.addColorStop(0.88, '#2563eb');
      orb.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(vsx, vsy, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const hlA = t * 0.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(vsx + Math.cos(hlA) * 4, vsy + Math.sin(hlA) * 4 - 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(vsx + Math.cos(hlA + 2.2) * 6, vsy + Math.sin(hlA + 2.2) * 6, 1.3, 0, Math.PI * 2);
      ctx.fill();

      // The cursor: the bright point you actually steer, shown only while you're driving (hidden during autopilot). The
      // vacuum follows it with momentum, trailing behind, so a faint tether marks the relationship.
      if (manualInput) {
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cursor.x, cursor.y);
        ctx.lineTo(vsx, vsy);
        ctx.stroke();

        const cglow = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 14);
        cglow.addColorStop(0, '#ffffff');
        cglow.addColorStop(0.4, 'rgba(125, 211, 252, 0.9)');
        cglow.addColorStop(1, 'rgba(125, 211, 252, 0)');
        ctx.fillStyle = cglow;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particles.
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        const px = (p.x - cam.x) * sc;
        const py = (p.y - cam.y) * sc;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue}, 85%, 68%)`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0, p.life * 3), 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const size = sizeCanvas(canvas, ctx);
      viewW = size.width;
      viewH = size.height;
      cursor.x = cursor.x || viewW / 2;
      cursor.y = cursor.y || viewH / 2;
    };

    const onMove = (e: PointerEvent) => {
      resumeAudio();
      const rect = canvas.getBoundingClientRect();
      pointer.x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      pointer.y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      pointer.active = true;
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    startRound();
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      apiRef.current = null;
    };
  }, [canvasRef, store, publish, apiRef]);
};

export default useTrashFlow;
