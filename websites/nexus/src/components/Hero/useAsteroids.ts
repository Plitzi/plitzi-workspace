import { type RefObject, useEffect } from 'react';

import { leadPoint } from './heroAim';
import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { keyAxisX, keyAxisY } from './heroKeys';
import { isPaused } from './heroPause';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';
import { isHeroVisible } from './heroVisibility';

const BOLT_SPEED = 6.5;

type Rock ={ x: number; y: number; vx: number; vy: number; r: number; angle: number; spin: number; verts: number[] };
type Bolt = { x: number; y: number; vx: number; vy: number; life: number };
type SaucerKind = 'cross' | 'hunter' | 'weaver' | 'sniper';
type Saucer = { x: number; y: number; vx: number; vy: number; kind: SaucerKind; bornAt: number; phase: number };
type PowerKind = 'rapid' | 'triple' | 'shield';
type Power = { x: number; y: number; vx: number; vy: number; kind: PowerKind };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Floater = { x: number; y: number; text: string; life: number };
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
    const enemyBolts: Bolt[] = [];
    const powers: Power[] = [];
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
    const saucers: Saucer[] = [];
    let nextSaucerAt = 0;

    const addFloater = (x: number, y: number, text: string) => {
      floaters.push({ x, y, text, life: 1 });
    };
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
      const sp = rand(0.2, 0.52) * (1 + state.level * 0.06);
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

    // Enemy saucers: four distinct designs. 'cross' flies straight, 'hunter' chases, 'weaver' bobs in a sine path,
    // 'sniper' hangs back and fires precise lead shots. Shoot them for a bonus; their shots cost a life. More appear —
    // and more at once — as the level climbs.
    const SAUCER_KINDS: SaucerKind[] = ['cross', 'hunter', 'weaver', 'sniper'];
    const maxSaucers = () => Math.min(6, 2 + Math.floor(state.level / 2));

    const spawnSaucer = () => {
      const kind = SAUCER_KINDS[Math.floor(rand(0, SAUCER_KINDS.length))];
      const fromLeft = Math.random() < 0.5;
      const dirX = fromLeft ? 1 : -1;
      const speed = kind === 'weaver' ? 1.7 : kind === 'sniper' ? 0.5 : kind === 'hunter' ? 1 : 1.4;
      saucers.push({
        x: fromLeft ? -30 : width + 30,
        y: rand(50, height * 0.5),
        vx: dirX * speed,
        vy: 0,
        kind,
        bornAt: performance.now(),
        phase: rand(0, Math.PI * 2)
      });
    };

    const buildWave = () => {
      rocks.length = 0;
      bolts.length = 0;
      enemyBolts.length = 0;
      powers.length = 0;
      // Centre the ship and ring the rocks around it, so the wave opens with the ship in the middle of the chaos.
      ship.x = width / 2;
      ship.y = height / 2;
      ship.vx = 0;
      ship.vy = 0;
      const safe = 150;
      const reach = Math.min(width, height) * 0.46;
      const count = 4 + state.level;
      for (let i = 0; i < count; i += 1) {
        const ang = rand(0, Math.PI * 2);
        const radius = rand(safe, Math.max(safe + 40, reach));
        spawnRock(width / 2 + Math.cos(ang) * radius, height / 2 + Math.sin(ang) * radius, rand(34, 46));
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
      saucers.length = 0;
      enemyBolts.length = 0;
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
      if (isPaused()) {
        return;
      }

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

      // Nearest target among rocks AND saucers — the turret tracks it every frame so shots converge on what's closest,
      // and the autopilot flies toward it (or strafes when right on top of it). We also capture its velocity so the
      // cannon can lead a moving target instead of firing where it used to be.
      let nearX = ship.x;
      let nearY = ship.y - 1;
      let nearVx = 0;
      let nearVy = 0;
      let nearDist = Infinity;
      for (const rock of rocks) {
        const d = Math.hypot(rock.x - ship.x, rock.y - ship.y);
        if (d < nearDist) {
          nearDist = d;
          nearX = rock.x;
          nearY = rock.y;
          nearVx = rock.vx;
          nearVy = rock.vy;
        }
      }

      for (const s of saucers) {
        const d = Math.hypot(s.x - ship.x, s.y - ship.y);
        if (d < nearDist) {
          nearDist = d;
          nearX = s.x;
          nearY = s.y;
          nearVx = s.vx;
          nearVy = s.vy;
        }
      }

      // Vectorial intercept: aim at where the target will be when a bolt reaches it, not its current position.
      const aim = leadPoint(ship.x, ship.y, nearX, nearY, nearVx, nearVy, BOLT_SPEED);

      // Keyboard flight overrides everything: rotate with ←/→ (A/D), thrust with ↑ (W), brake with ↓ (S).
      const kx = keyAxisX();
      const ky = keyAxisY();
      const keyboard = kx !== 0 || ky !== 0;

      // Player controls whenever the cursor is over the play area — even held still. The AI only flies once the cursor
      // leaves, unless the idle-autoplay flag is on (attract mode).
      const autopilot = !keyboard && (!pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS));
      if (keyboard) {
        ship.heading += kx * 0.07;
        if (ky < 0) {
          ship.vx += Math.cos(ship.heading) * 0.09;
          ship.vy += Math.sin(ship.heading) * 0.09;
        } else if (ky > 0) {
          ship.vx *= 0.95;
          ship.vy *= 0.95;
        }

        ship.vx *= 0.99;
        ship.vy *= 0.99;
      } else {
        let tx: number;
        let ty: number;
        let accel: number;
        if (autopilot) {
          // First priority: dodge an incoming enemy shot that's actually heading at the ship.
          let dodge: Bolt | undefined;
          for (const eb of enemyBolts) {
            const dx = ship.x - eb.x;
            const dy = ship.y - eb.y;
            if (Math.hypot(dx, dy) < 140 && dx * eb.vx + dy * eb.vy > 0) {
              dodge = eb;
              break;
            }
          }

          if (dodge) {
            // Sidestep perpendicular to the shot's path.
            const ang = Math.atan2(dodge.vy, dodge.vx) + Math.PI / 2;
            tx = ship.x + Math.cos(ang) * 160;
            ty = ship.y + Math.sin(ang) * 160;
            accel = 0.0045;
          } else if (nearDist < 120) {
            // Strafe around the target rather than reversing — much calmer than a flip-flop.
            const ang = Math.atan2(nearY - ship.y, nearX - ship.x) + Math.PI / 2;
            tx = ship.x + Math.cos(ang) * 180;
            ty = ship.y + Math.sin(ang) * 180;
            accel = 0.003;
          } else {
            tx = nearX;
            ty = nearY;
            accel = 0.003;
          }
        } else {
          tx = pointer.x;
          ty = pointer.y;
          accel = 0.0038;
        }

        // Momentum: the destination is the cursor (or the AI's target); the ship eases over, it never snaps.
        ship.vx = (ship.vx + (tx - ship.x) * accel) * 0.9;
        ship.vy = (ship.vy + (ty - ship.y) * accel) * 0.9;
      }

      // Slower top speed than before so the ship feels weightier and easier to control.
      const speed = Math.hypot(ship.vx, ship.vy);
      const maxV = autopilot ? 2.0 : 2.5;
      if (speed > maxV) {
        ship.vx = (ship.vx / speed) * maxV;
        ship.vy = (ship.vy / speed) * maxV;
      }

      ship.x = Math.max(SHIP_R, Math.min(width - SHIP_R, ship.x + ship.vx));
      ship.y = Math.max(SHIP_R, Math.min(height - SHIP_R, ship.y + ship.vy));
      ship.thrust = Math.min(1, speed / 2);

      // The hull turns to the lead point (turret) — unless the player is steering by keyboard, which sets heading
      // directly. Because the cannon fires along the heading, shots converge on where the target is heading.
      const desired = keyboard ? ship.heading : Math.atan2(aim.y - ship.y, aim.x - ship.x);
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
            vx: Math.cos(a) * BOLT_SPEED,
            vy: Math.sin(a) * BOLT_SPEED,
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

        let consumed = false;
        for (let r = rocks.length - 1; r >= 0; r -= 1) {
          const rock = rocks[r];
          if (Math.hypot(rock.x - bolt.x, rock.y - bolt.y) < rock.r) {
            bolts.splice(b, 1);
            rocks.splice(r, 1);
            const gain = Math.round(60 - rock.r);
            state.score += gain;
            state.hits += 1;
            state.best = Math.max(state.best, state.score);
            sfx.explode();
            burst(rock.x, rock.y, 258, 12);
            addFloater(rock.x, rock.y, `+${gain}`);
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
            consumed = true;
            break;
          }
        }

        if (!consumed) {
          for (let s = saucers.length - 1; s >= 0; s -= 1) {
            const uf = saucers[s];
            if (Math.hypot(uf.x - bolt.x, uf.y - bolt.y) < 16) {
              bolts.splice(b, 1);
              saucers.splice(s, 1);
              state.score += 150;
              state.hits += 1;
              state.best = Math.max(state.best, state.score);
              sfx.explode();
              burst(uf.x, uf.y, 50, 18);
              addFloater(uf.x, uf.y, '+150');
              publish({ score: state.score, hits: state.hits, best: state.best });
              break;
            }
          }
        }
      }

      // Four enemy behaviours: 'hunter' chases and lingers; 'weaver' bobs in a sine path; 'sniper' hangs mid-field and
      // fires precise lead shots; 'cross' flies straight across. Each fires differently.
      for (let s = saucers.length - 1; s >= 0; s -= 1) {
        const uf = saucers[s];
        if (uf.kind === 'hunter') {
          uf.vx += (ship.x - uf.x) * 0.0007;
          uf.vy += (ship.y - uf.y) * 0.0007;
          uf.vx *= 0.97;
          uf.vy *= 0.97;
          const sp = Math.hypot(uf.vx, uf.vy);
          if (sp > 2.4) {
            uf.vx = (uf.vx / sp) * 2.4;
            uf.vy = (uf.vy / sp) * 2.4;
          }

          uf.x += uf.vx;
          uf.y += uf.vy;
          if (now - uf.bornAt > 14000) {
            saucers.splice(s, 1);
            continue;
          }
        } else if (uf.kind === 'weaver') {
          uf.phase += 0.06;
          uf.x += uf.vx;
          uf.y += Math.sin(uf.phase) * 2.4;
          if (uf.x < -50 || uf.x > width + 50) {
            saucers.splice(s, 1);
            continue;
          }
        } else if (uf.kind === 'sniper') {
          // Drifts slowly and eases toward a mid-field hover, then leaves after a while.
          uf.x += uf.vx;
          uf.y += (height * 0.32 - uf.y) * 0.012;
          if (now - uf.bornAt > 16000 || uf.x < -50 || uf.x > width + 50) {
            saucers.splice(s, 1);
            continue;
          }
        } else {
          uf.x += uf.vx;
          if (uf.x < -50 || uf.x > width + 50) {
            saucers.splice(s, 1);
            continue;
          }
        }

        if (uf.kind === 'sniper') {
          // Rare, precise: lead the ship and fire a faster bolt right at the intercept.
          if (Math.random() < 0.013) {
            const sniperSpeed = 4.4;
            const pt = leadPoint(uf.x, uf.y, ship.x, ship.y, ship.vx, ship.vy, sniperSpeed);
            const a = Math.atan2(pt.y - uf.y, pt.x - uf.x);
            enemyBolts.push({ x: uf.x, y: uf.y, vx: Math.cos(a) * sniperSpeed, vy: Math.sin(a) * sniperSpeed, life: 1 });
            sfx.shoot();
          }
        } else if (uf.kind === 'weaver') {
          // Frequent two-shot spread.
          if (Math.random() < 0.02) {
            const a = Math.atan2(ship.y - uf.y, ship.x - uf.x);
            for (const off of [-0.16, 0.16]) {
              enemyBolts.push({ x: uf.x, y: uf.y, vx: Math.cos(a + off) * 3.2, vy: Math.sin(a + off) * 3.2, life: 1 });
            }

            sfx.shoot();
          }
        } else if (Math.random() < (uf.kind === 'hunter' ? 0.016 : 0.011)) {
          const a = Math.atan2(ship.y - uf.y, ship.x - uf.x);
          enemyBolts.push({ x: uf.x, y: uf.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 1 });
          sfx.shoot();
        }
      }

      if (saucers.length < maxSaucers() && now > nextSaucerAt) {
        spawnSaucer();
        // Spawns come faster at higher levels so the pressure builds.
        nextSaucerAt = now + Math.max(2200, rand(4000, 7500) - state.level * 350);
      }

      for (let e = enemyBolts.length - 1; e >= 0; e -= 1) {
        const eb = enemyBolts[e];
        eb.x += eb.vx;
        eb.y += eb.vy;
        eb.life -= 0.008;
        if (eb.life <= 0 || eb.x < -10 || eb.x > width + 10 || eb.y < -10 || eb.y > height + 10) {
          enemyBolts.splice(e, 1);
          continue;
        }

        if (!invulnerable && Math.hypot(eb.x - ship.x, eb.y - ship.y) < SHIP_R) {
          enemyBolts.splice(e, 1);
          loseLife();
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
      // While paused or scrolled off screen, skip BOTH physics and rendering: the canvas keeps its last frame and the
      // GPU goes idle.
      if (isPaused() || !isHeroVisible()) {
        return;
      }

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

      // Enemy ships — four distinct designs.
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.6;
      for (const uf of saucers) {
        if (uf.kind === 'cross') {
          // Classic UFO: a magenta saucer with a glass dome.
          ctx.shadowColor = '#f0abfc';
          ctx.fillStyle = 'rgba(240, 171, 252, 0.25)';
          ctx.strokeStyle = '#f0abfc';
          ctx.beginPath();
          ctx.ellipse(uf.x, uf.y, 16, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(uf.x, uf.y - 4, 7, 5, 0, Math.PI, 0);
          ctx.stroke();
        } else if (uf.kind === 'hunter') {
          // Hunter: an angular red interceptor pointing the way it's heading, with swept wings and a hot core.
          const heading = Math.atan2(uf.vy, uf.vx) || 0;
          ctx.save();
          ctx.translate(uf.x, uf.y);
          ctx.rotate(heading);
          ctx.shadowColor = '#f87171';
          ctx.fillStyle = 'rgba(248, 113, 113, 0.3)';
          ctx.strokeStyle = '#fca5a5';
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-6, 9);
          ctx.lineTo(-12, 0);
          ctx.lineTo(-6, -9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(-2, 0, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (uf.kind === 'weaver') {
          // Weaver: a teal diamond drone with a glowing core, bobbing as it crosses.
          ctx.save();
          ctx.translate(uf.x, uf.y);
          ctx.shadowColor = '#5eead4';
          ctx.fillStyle = 'rgba(94, 234, 212, 0.25)';
          ctx.strokeStyle = '#5eead4';
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(13, 0);
          ctx.lineTo(0, 11);
          ctx.lineTo(-13, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#99f6e4';
          ctx.beginPath();
          ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Sniper: an amber hexagonal turret with a barrel trained on the ship.
          const a = Math.atan2(ship.y - uf.y, ship.x - uf.x);
          ctx.save();
          ctx.translate(uf.x, uf.y);
          ctx.shadowColor = '#fbbf24';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.strokeStyle = '#fbbf24';
          ctx.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const ang = (i / 6) * Math.PI * 2;
            const px = Math.cos(ang) * 12;
            const py = Math.sin(ang) * 12;
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }

          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
          ctx.stroke();
          ctx.lineWidth = 1.6;
          ctx.restore();
        }
      }

      ctx.shadowColor = '#fca5a5';
      ctx.fillStyle = '#fca5a5';
      for (const eb of enemyBolts) {
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, 2.6, 0, Math.PI * 2);
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

      // Floating score popups.
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      for (let f = floaters.length - 1; f >= 0; f -= 1) {
        const fl = floaters[f];
        fl.y -= 0.6;
        fl.life -= 0.02;
        ctx.globalAlpha = Math.max(0, fl.life);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText(fl.text, fl.x, fl.y);
        if (fl.life <= 0) {
          floaters.splice(f, 1);
        }
      }

      ctx.textAlign = 'start';
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
    nextSaucerAt = performance.now() + 3500;
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
