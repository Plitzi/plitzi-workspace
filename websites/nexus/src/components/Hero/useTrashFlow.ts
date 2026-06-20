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
  airPull,
  batterySeconds,
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
  claimDouble: () => void;
  newRun: () => void;
};

// A huge confetti world far larger than the viewport; early levels are zoomed in on a corner of it and each level zooms
// OUT to reveal more, while the camera pans whenever the vacuum nears an edge — so the map always feels vast.
const WORLD_W = 2800;
const WORLD_H = 1900;
const LEVEL_CAP = 10;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Zoom shrinks each level (more of the world on screen), floored so it never gets too tiny.
const scaleOf = (level: number) => Math.max(0.42, 1.15 * 0.88 ** (level - 1));

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
    let lastFrame = 0;
    let lastNow = performance.now();
    let nextId = 0;
    let publishAt = 0;

    const scraps: Scrap[] = [];
    const particles: Particle[] = [];
    const updates: { id: string; changes: Partial<Scrap> }[] = [];
    const pointer = { x: 0, y: 0, active: false };
    const cursor = { x: 0, y: 0 };
    const vac = { x: WORLD_W / 2, y: WORLD_H / 2 };
    const cam = { x: 0, y: 0 };
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
      runDoubled: false,
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

    const fieldCount = () => Math.min(1600, 560 + game.level * 130);

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
        runDoubled: game.runDoubled,
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
      game.runDoubled = false;
      vac.x = WORLD_W / 2;
      vac.y = WORLD_H / 2;
      spawnField();
      pushHud();
    };

    // The run is over: freeze play and show the results card. Battery-out keeps `cleared` false; clearing level 10 sets
    // it true so the summary reads "run complete" instead of "battery dead".
    const endRun = () => {
      game.phase = 'summary';
      sfx.power();
      pushHud();
    };

    // Clearing a level's target mid-round bumps the level, tops up the field and refunds a slice of battery — so a fast
    // clear extends the run. Clearing level 10 ends the round.
    const advanceLevel = () => {
      if (game.level >= LEVEL_CAP) {
        game.cleared = true;
        endRun();

        return;
      }

      game.level += 1;
      game.levelEarned = 0;
      game.target = levelTarget(game.level);
      game.batteryMs = Math.min(game.batteryMax, game.batteryMs + game.batteryMax * 0.3);
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

        return true;
      },
      toShop: () => {
        if (game.phase !== 'summary') {
          return;
        }

        game.phase = 'shop';
        pushHud();
      },
      claimDouble: () => {
        if (game.phase !== 'summary' || game.runDoubled || game.runPoints <= 0) {
          return;
        }

        game.points += game.runPoints;
        game.allTimePoints += game.runPoints;
        game.runPoints *= 2;
        game.runDoubled = true;
        sfx.power();
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
      // the nearest scrap). The vacuum is NOT the cursor — it eases toward it with a slow trailing lag.
      const kx = keyAxisX();
      const ky = keyAxisY();
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

      // The vacuum is NOT the cursor — it chases it at its own speed, so there is always a visible trailing gap. Speed is
      // a slow constant base plus a term that grows with the gap, so a far-flung cursor gets caught quickly while a
      // nearby one is followed lazily. `min(gap, …)` stops it overshooting once it arrives.
      const tgtX = cam.x + cursor.x / sc;
      const tgtY = cam.y + cursor.y / sc;
      const gx = tgtX - vac.x;
      const gy = tgtY - vac.y;
      const gap = Math.hypot(gx, gy);
      if (gap > 0.001) {
        const speed = Math.min(gap, 2.6 + gap * 0.07);
        vac.x += (gx / gap) * speed;
        vac.y += (gy / gap) * speed;
      }

      vac.x = Math.max(0, Math.min(WORLD_W, vac.x));
      vac.y = Math.max(0, Math.min(WORLD_H, vac.y));

      // Deadzone camera: pans only when the vacuum pushes past a central box, by exactly the overflow — smooth, no zip,
      // and it scrolls the huge world at the borders.
      const vsx = (vac.x - cam.x) * sc;
      const vsy = (vac.y - cam.y) * sc;
      const dzx = viewW * 0.26;
      const dzy = viewH * 0.26;
      const cx = viewW / 2;
      const cy = viewH / 2;
      if (vsx < cx - dzx) {
        cam.x -= (cx - dzx - vsx) / sc;
      } else if (vsx > cx + dzx) {
        cam.x += (vsx - (cx + dzx)) / sc;
      }

      if (vsy < cy - dzy) {
        cam.y -= (cy - dzy - vsy) / sc;
      } else if (vsy > cy + dzy) {
        cam.y += (vsy - (cy + dzy)) / sc;
      }

      cam.x = Math.max(0, Math.min(Math.max(0, WORLD_W - visW), cam.x));
      cam.y = Math.max(0, Math.min(Math.max(0, WORLD_H - visH), cam.y));

      // Two-stage suction. Scraps inside the OUTER ring (suction radius) ease toward the centre at the Air-Speed rate;
      // they're only absorbed once they cross the INNER ring. Up to `pipe` scraps drawn in at once.
      const outerR = suctionRadius(stats.radius);
      const innerR = Math.max(16, outerR * 0.3);
      const pull = airPull(stats.air);
      const pipe = pipeCapacity(stats.pipe);
      let active = 0;
      const removed: string[] = [];
      updates.length = 0;
      for (let i = scraps.length - 1; i >= 0; i -= 1) {
        const s = scraps[i];
        const dx = vac.x - s.x;
        const dy = vac.y - s.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < outerR && active < pipe) {
          active += 1;
          // Eased in at the Air-Speed fraction, a touch faster the closer it gets — no spin, a clean inward draw.
          const f = pull * (0.6 + 0.4 * (1 - d / outerR));
          s.x += dx * f;
          s.y += dy * f;
          if (d < innerR) {
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

      // Battery drains the run clock; empty → the run ends and the results card shows.
      game.batteryMs -= dt;
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

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // While paused or scrolled off screen, freeze everything — no physics, no repaint, GPU idle.
      if (isPaused() || !isHeroVisible()) {
        lastNow = now;

        return;
      }

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

      // The vacuum: a blue glowing orb behind two rings — an outer ticked dial (the suction radius, where scraps start
      // to be drawn in) and a faint inner ring (the absorb threshold). Drawn at the vacuum's trailing position.
      const vsx = (vac.x - cam.x) * sc;
      const vsy = (vac.y - cam.y) * sc;
      const outer = suctionRadius(stats.radius) * sc;
      const inner = Math.max(16, suctionRadius(stats.radius) * 0.3) * sc;
      const t = now / 1000;

      // Soft field glow within the suction radius.
      const field = ctx.createRadialGradient(vsx, vsy, inner * 0.6, vsx, vsy, outer);
      field.addColorStop(0, 'rgba(59, 130, 246, 0.10)');
      field.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.arc(vsx, vsy, outer, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring: a slowly rotating dial of short radial ticks.
      ctx.save();
      ctx.translate(vsx, vsy);
      ctx.rotate(t * 0.35);
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
      ctx.lineWidth = 1.4;
      const ticks = 40;
      for (let i = 0; i < ticks; i += 1) {
        const a = (i / ticks) * Math.PI * 2;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(cosA * (outer - 4), sinA * (outer - 4));
        ctx.lineTo(cosA * outer, sinA * outer);
        ctx.stroke();
      }

      ctx.restore();

      // Inner ring: a faint absorb threshold, counter-rotating with a few brighter ticks.
      ctx.save();
      ctx.translate(vsx, vsy);
      ctx.rotate(-t * 0.8);
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.7)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, inner, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(219, 234, 254, 0.9)';
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * inner, Math.sin(a) * inner, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Glowing blue orb core with two bright highlights.
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#3b82f6';
      const orb = ctx.createRadialGradient(vsx, vsy, 0, vsx, vsy, 15);
      orb.addColorStop(0, '#ffffff');
      orb.addColorStop(0.35, '#bfdbfe');
      orb.addColorStop(0.7, '#3b82f6');
      orb.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(vsx, vsy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(vsx - 3, vsy - 1.5, 2.1, 0, Math.PI * 2);
      ctx.arc(vsx + 3.5, vsy - 0.5, 1.6, 0, Math.PI * 2);
      ctx.fill();

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
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      apiRef.current = null;
    };
  }, [canvasRef, store, publish, apiRef]);
};

export default useTrashFlow;
