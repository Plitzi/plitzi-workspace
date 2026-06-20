import { type RefObject, useEffect } from 'react';

import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';

type Rock = { x: number; y: number; vx: number; vy: number; r: number; angle: number; spin: number; verts: number[] };
type Bolt = { x: number; y: number; vx: number; vy: number; life: number };
type PowerKind = 'rapid' | 'triple' | 'shield';
type Power = { x: number; y: number; vx: number; vy: number; kind: PowerKind };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Star = { x: number; y: number; r: number; spd: number };

const POWER_COLORS: Record<PowerKind, string> = { rapid: '#fbbf24', triple: '#34d399', shield: '#60a5fa' };
const POWER_LETTER: Record<PowerKind, string> = { rapid: 'R', triple: '3', shield: '◇' };
const POWER_KINDS: PowerKind[] = ['rapid', 'triple', 'shield'];

const SHIP_R = 13;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const makeVerts = () => {
  const n = 9;
  const verts: number[] = [];
  for (let i = 0; i < n; i += 1) {
    verts.push(rand(0.74, 1.12));
  }

  return verts;
};

const useAsteroids = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;

    const stars: Star[] = [];
    const rocks: Rock[] = [];
    const bolts: Bolt[] = [];
    const powers: Power[] = [];
    const particles: Particle[] = [];
    const pointer = { x: 0, y: 0, active: false, lastMove: 0 };
    const ship = { x: 0, y: 0, vx: 0, vy: 0, heading: -Math.PI / 2, thrust: 0 };
    const state = { score: 0, level: 1, lives: 3, hits: 0, best: 0 };
    let lastFire = 0;
    let invulnUntil = 0;
    let rapidUntil = 0;
    let tripleUntil = 0;
    let shake = 0;
    let raf = 0;
    let lastFrame = 0;
    let respawnAt = 0;
    let aimRock: Rock | undefined;
    let aimUntil = 0;

    const seedStars = () => {
      stars.length = 0;
      const count = Math.round(Math.min(140, (width * height) / 9000));
      for (let i = 0; i < count; i += 1) {
        stars.push({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), spd: rand(0.08, 0.5) });
      }
    };

    const spawnRock = (x: number, y: number, r: number) => {
      const a = rand(0, Math.PI * 2);
      // Gradual: gentle drift early, a small bump per level so aiming stays fair.
      const sp = rand(0.22, 0.6) * (1 + state.level * 0.08);
      rocks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r,
        angle: rand(0, Math.PI * 2),
        spin: rand(-0.02, 0.02),
        verts: makeVerts()
      });
    };

    const buildWave = () => {
      rocks.length = 0;
      bolts.length = 0;
      powers.length = 0;
      const count = 3 + state.level;
      for (let i = 0; i < count; i += 1) {
        const edge = Math.random() < 0.5;
        spawnRock(edge ? rand(0, width) : 0, edge ? 0 : rand(0, height), rand(34, 46));
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ship.x = ship.x || width / 2;
      ship.y = ship.y || height / 2;
      seedStars();
      if (!rocks.length) {
        buildWave();
      }
    };

    const burst = (x: number, y: number, hue: number, n: number) => {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2);
        const s = rand(0.6, 3);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const wrap = (o: { x: number; y: number }) => {
      if (o.x < 0) {
        o.x += width;
      } else if (o.x > width) {
        o.x -= width;
      }

      if (o.y < 0) {
        o.y += height;
      } else if (o.y > height) {
        o.y -= height;
      }
    };

    const resetGame = () => {
      state.best = Math.max(state.best, state.score);
      state.score = 0;
      state.level = 1;
      state.lives = 3;
      publish({ best: state.best, score: 0, level: 1, lives: 3 });
      buildWave();
    };

    const loseLife = () => {
      state.lives -= 1;
      shake = 16;
      sfx.hurt();
      burst(ship.x, ship.y, 258, 22);
      burst(ship.x, ship.y, 30, 22);
      if (state.lives <= 0) {
        resetGame();

        return;
      }

      publish({ lives: state.lives });
      // Explosion, then a 3-2-1 countdown during which the rocks freeze, then respawn in the centre.
      const now = performance.now();
      respawnAt = now + 3000;
      invulnUntil = respawnAt + 1500;
      ship.x = width / 2;
      ship.y = height / 2;
      ship.vx = 0;
      ship.vy = 0;
    };

    const update = (now: number) => {
      // Frozen during the respawn countdown.
      if (now < respawnAt) {
        return;
      }

      if (!rocks.length) {
        state.level += 1;
        publish({ level: state.level });
        buildWave();

        return;
      }

      // Truly nearest rock — the turret tracks it every frame so shots always converge on what's closest.
      let nearest = rocks[0];
      let nd = Infinity;
      for (const rock of rocks) {
        const d = Math.hypot(rock.x - ship.x, rock.y - ship.y);
        if (d < nd) {
          nd = d;
          nearest = rock;
        }
      }

      // Player controls whenever the cursor is over the play area — even held still. The AI only flies once the cursor
      // leaves, unless the idle-autoplay flag is on (attract mode).
      const autopilot = !pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS);
      let tx: number;
      let ty: number;
      let accel: number;
      if (autopilot) {
        // Commit to one rock for a short window so the AI locks on instead of switching between equidistant rocks.
        if (!aimRock || !rocks.includes(aimRock) || now > aimUntil) {
          aimRock = nearest;
          aimUntil = now + 700;
        }

        const dist = Math.hypot(aimRock.x - ship.x, aimRock.y - ship.y);
        if (dist < 120) {
          // Strafe around it rather than reversing — much calmer than a flip-flop.
          const ang = Math.atan2(aimRock.y - ship.y, aimRock.x - ship.x) + Math.PI / 2;
          tx = ship.x + Math.cos(ang) * 180;
          ty = ship.y + Math.sin(ang) * 180;
        } else {
          tx = aimRock.x;
          ty = aimRock.y;
        }

        accel = 0.0035;
      } else {
        tx = pointer.x;
        ty = pointer.y;
        accel = 0.0045;
      }

      // Momentum: the destination is the cursor (or the AI's target); the ship eases over, it never snaps. Capped low
      // so following the cursor feels controlled, not twitchy.
      ship.vx = (ship.vx + (tx - ship.x) * accel) * 0.9;
      ship.vy = (ship.vy + (ty - ship.y) * accel) * 0.9;
      const speed = Math.hypot(ship.vx, ship.vy);
      const maxV = autopilot ? 2.8 : 3.6;
      if (speed > maxV) {
        ship.vx = (ship.vx / speed) * maxV;
        ship.vy = (ship.vy / speed) * maxV;
      }

      ship.x = Math.max(SHIP_R, Math.min(width - SHIP_R, ship.x + ship.vx));
      ship.y = Math.max(SHIP_R, Math.min(height - SHIP_R, ship.y + ship.vy));
      ship.thrust = Math.min(1, speed / 2);

      // The hull turns to aim at the nearest rock (turret). Because the cannon fires along the heading, shots converge
      // on the nearest rock instead of zig-zagging with the ship's drift.
      const desired = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
      let diff = desired - ship.heading;
      while (diff > Math.PI) {
        diff -= Math.PI * 2;
      }
      while (diff < -Math.PI) {
        diff += Math.PI * 2;
      }
      ship.heading += diff * 0.3;

      // Power-ups bend the cannon: rapid fire shortens the cooldown, triple fires a 3-way volley.
      const rapid = now < rapidUntil;
      const triple = now < tripleUntil;
      if (now - lastFire > (rapid ? 170 : 360)) {
        const shoot = (a: number) =>
          bolts.push({
            x: ship.x + Math.cos(a) * SHIP_R,
            y: ship.y + Math.sin(a) * SHIP_R,
            vx: Math.cos(a) * 6.5,
            vy: Math.sin(a) * 6.5,
            life: 1
          });
        if (triple) {
          shoot(ship.heading - 0.2);
          shoot(ship.heading);
          shoot(ship.heading + 0.2);
        } else {
          shoot(ship.heading);
        }

        sfx.shoot();
        lastFire = now;
      }

      for (const rock of rocks) {
        rock.x += rock.vx;
        rock.y += rock.vy;
        rock.angle += rock.spin;
        wrap(rock);
      }

      // Falling power-ups drift and wrap; collected by flying over them.
      for (let p = powers.length - 1; p >= 0; p -= 1) {
        const power = powers[p];
        power.x += power.vx;
        power.y += power.vy;
        wrap(power);
        if (Math.hypot(power.x - ship.x, power.y - ship.y) < SHIP_R + 12) {
          powers.splice(p, 1);
          if (power.kind === 'rapid') {
            rapidUntil = now + 7000;
          } else if (power.kind === 'triple') {
            tripleUntil = now + 7000;
          } else {
            invulnUntil = now + 5000;
          }

          sfx.power();
          burst(power.x, power.y, 50, 14);
        }
      }

      const invulnerable = now < invulnUntil;
      for (let b = bolts.length - 1; b >= 0; b -= 1) {
        const bolt = bolts[b];
        bolt.x += bolt.vx;
        bolt.y += bolt.vy;
        bolt.life -= 0.018;
        if (bolt.life <= 0) {
          bolts.splice(b, 1);
          continue;
        }

        for (let r = rocks.length - 1; r >= 0; r -= 1) {
          const rock = rocks[r];
          if (Math.hypot(rock.x - bolt.x, rock.y - bolt.y) < rock.r) {
            bolts.splice(b, 1);
            rocks.splice(r, 1);
            state.score += Math.round(60 - rock.r);
            state.hits += 1;
            state.best = Math.max(state.best, state.score);
            sfx.explode();
            burst(rock.x, rock.y, 258, 12);
            if (rock.r > 22) {
              spawnRock(rock.x, rock.y, rock.r * 0.58);
              spawnRock(rock.x, rock.y, rock.r * 0.58);
            } else if (powers.length < 2 && Math.random() < 0.18) {
              powers.push({
                x: rock.x,
                y: rock.y,
                vx: rand(-0.4, 0.4),
                vy: rand(-0.4, 0.4),
                kind: POWER_KINDS[Math.floor(rand(0, POWER_KINDS.length))]
              });
            }

            publish({ score: state.score, hits: state.hits, best: state.best });
            break;
          }
        }
      }

      if (!invulnerable) {
        for (const rock of rocks) {
          if (Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r + SHIP_R) {
            loseLife();
            break;
          }
        }
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // Physics every tick (constant speed); only rendering is throttled in low-performance mode.
      update(now);
      if (now - lastFrame < minFrameMs()) {
        return;
      }

      lastFrame = now;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#fff';
      for (const star of stars) {
        if (!reduced) {
          star.y += star.spd;
          if (star.y > height) {
            star.y = 0;
            star.x = rand(0, width);
          }
        }

        ctx.globalAlpha = star.r / 1.8;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.save();
      if (shake > 0) {
        ctx.translate(rand(-shake, shake), rand(-shake, shake));
        shake *= 0.85;
        if (shake < 0.4) {
          shake = 0;
        }
      }

      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.6;
      for (const rock of rocks) {
        ctx.strokeStyle = 'hsl(256, 70%, 74%)';
        ctx.shadowColor = '#a78bfa';
        ctx.beginPath();
        for (let i = 0; i < rock.verts.length; i += 1) {
          const a = rock.angle + (i / rock.verts.length) * Math.PI * 2;
          const rr = rock.r * rock.verts[i];
          const px = rock.x + Math.cos(a) * rr;
          const py = rock.y + Math.sin(a) * rr;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }

        ctx.closePath();
        ctx.stroke();
      }

      ctx.shadowColor = '#ddd6fe';
      ctx.fillStyle = '#ede9fe';
      for (const bolt of bolts) {
        ctx.beginPath();
        ctx.arc(bolt.x, bolt.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const power of powers) {
        const color = POWER_COLORS[power.kind];
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}22`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(power.x, power.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(POWER_LETTER[power.kind], power.x, power.y + 0.5);
      }

      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      const reviving = now < respawnAt;
      const blink = now < invulnUntil && Math.floor(now / 120) % 2 === 0;
      if (!reviving && !blink) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.heading);

        // Thrust flame — flickers, scaled by current speed.
        if (ship.thrust > 0.08) {
          const flame = SHIP_R * (0.6 + ship.thrust * 1.1) * (0.7 + Math.random() * 0.3);
          ctx.shadowColor = '#f0abfc';
          ctx.fillStyle = 'rgba(240, 171, 252, 0.85)';
          ctx.beginPath();
          ctx.moveTo(-SHIP_R * 0.5, SHIP_R * 0.34);
          ctx.lineTo(-SHIP_R * 0.5 - flame, 0);
          ctx.lineTo(-SHIP_R * 0.5, -SHIP_R * 0.34);
          ctx.closePath();
          ctx.fill();
        }

        // Hull: a sleeker delta with a swept body and a cockpit.
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 10;
        const hull = ctx.createLinearGradient(-SHIP_R, 0, SHIP_R, 0);
        hull.addColorStop(0, '#6d28d9');
        hull.addColorStop(1, '#ede9fe');
        ctx.fillStyle = hull;
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(SHIP_R * 1.15, 0);
        ctx.lineTo(-SHIP_R * 0.55, SHIP_R * 0.62);
        ctx.lineTo(-SHIP_R * 0.25, 0);
        ctx.lineTo(-SHIP_R * 0.55, -SHIP_R * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // cockpit
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(SHIP_R * 0.25, 0, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      for (let p = particles.length - 1; p >= 0; p -= 1) {
        const part = particles[p];
        part.x += part.vx;
        part.y += part.vy;
        part.vx *= 0.93;
        part.vy *= 0.93;
        part.life -= 0.028;
        ctx.globalAlpha = Math.max(0, part.life);
        ctx.fillStyle = `hsl(${part.hue}, 90%, 72%)`;
        ctx.beginPath();
        ctx.arc(part.x, part.y, Math.max(0, part.life * 2.6), 0, Math.PI * 2);
        ctx.fill();
        if (part.life <= 0) {
          particles.splice(p, 1);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();

      if (reviving) {
        const remaining = Math.ceil((respawnAt - now) / 1000);
        ctx.save();
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ede9fe';
        ctx.font = 'bold 64px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(remaining), width / 2, height / 2);
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#a78bfa';
        ctx.fillText('RESPAWN', width / 2, height / 2 + 46);
        ctx.restore();
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    };

    const onMove = (e: PointerEvent) => {
      resumeAudio();
      const rect = canvas.getBoundingClientRect();
      pointer.x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      pointer.y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      pointer.active = true;
      pointer.lastMove = performance.now();
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    publish({ score: 0, level: 1, lives: 3, hits: 0, best: 0 });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [canvasRef, publish]);
};

export default useAsteroids;
