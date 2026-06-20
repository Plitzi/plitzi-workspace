import { type RefObject, useEffect } from 'react';

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

export type TrashFlowApi = { buy: (key: StatKey) => boolean; next: () => void };

// A huge confetti world far larger than the viewport; early levels are zoomed in on a corner of it and each level zooms
// OUT to reveal more, while the camera pans whenever the vacuum nears an edge — so the map always feels vast.
const WORLD_W = 2800;
const WORLD_H = 1900;

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

    const ctx = canvas.getContext('2d');
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
      phase: 'playing' as 'playing' | 'shop'
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

    const spawnField = () => {
      scraps.length = 0;
      const count = Math.min(1600, 600 + game.level * 160);
      for (let i = 0; i < count; i += 1) {
        scraps.push(makeScrap());
      }

      store.setAll(scraps);
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
        phase: game.phase
      });
    };

    const startLevel = () => {
      game.phase = 'playing';
      game.levelEarned = 0;
      game.cleared = false;
      game.target = levelTarget(game.level);
      game.batteryMax = batterySeconds(stats.battery) * 1000;
      game.batteryMs = game.batteryMax;
      vac.x = WORLD_W / 2;
      vac.y = WORLD_H / 2;
      spawnField();
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
      next: () => {
        // Advance only if you actually hit the level's target; a battery-out run replays the same level.
        if (game.cleared) {
          game.level += 1;
        }

        startLevel();
      }
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

      if (game.phase === 'shop') {
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

      // Vacuum trails the cursor: catch-up speed scales with the gap — gentle when it's right under the cursor, quicker
      // the further it has fallen behind (capped so it stays smooth).
      const tgtX = cam.x + cursor.x / sc;
      const tgtY = cam.y + cursor.y / sc;
      const gx = tgtX - vac.x;
      const gy = tgtY - vac.y;
      const gap = Math.hypot(gx, gy);
      const frac = Math.min(0.1, 0.014 + gap * 0.00045);
      vac.x += gx * frac;
      vac.y += gy * frac;
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
            burst(s.x, s.y, s.hue);
            removed.push(s.id);
            scraps.splice(i, 1);
          } else {
            updates.push({ id: s.id, changes: { x: s.x, y: s.y } });
          }
        }
      }

      // Hitting the level's points target clears it and opens the shop early.
      if (!game.cleared && game.levelEarned >= game.target) {
        game.cleared = true;
        game.phase = 'shop';
        sfx.power();
        pushHud();

        return;
      }

      if (removed.length) {
        store.removeMany(removed);
        sfx.hit();
      }

      if (updates.length) {
        store.updateMany(updates);
      }

      // Battery drains the level clock; empty → the upgrade shop.
      game.batteryMs -= dt;
      if (game.batteryMs <= 0) {
        game.batteryMs = 0;
        game.phase = 'shop';
        pushHud();

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
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewW = rect.width;
      viewH = rect.height;
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    startLevel();
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
