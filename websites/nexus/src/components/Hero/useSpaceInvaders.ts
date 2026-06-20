import { type RefObject, useEffect } from 'react';

import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { keyAxisX } from './heroKeys';
import { isPaused } from './heroPause';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';
import { isHeroVisible } from './heroVisibility';

const BULLET_SPEED = 7.5;

// Three classic 11×8 invader species, two march frames each — drawn as glowing cells for a neon-vector look.
const CRAB_A = [
  '00100000100',
  '00010001000',
  '00111111100',
  '01101110110',
  '11111111111',
  '10111111101',
  '10100000101',
  '00011011000'
];
const CRAB_B = [
  '00100000100',
  '10010001001',
  '10111111101',
  '11101110111',
  '11111111111',
  '01111111110',
  '00100000100',
  '01000000010'
];
const SQUID_A = [
  '00011011000',
  '00111111100',
  '01111111110',
  '11011011011',
  '11111111111',
  '00111111100',
  '01100000110',
  '00110000110'
];
const SQUID_B = [
  '00011011000',
  '00111111100',
  '01111111110',
  '11011011011',
  '11111111111',
  '00100100100',
  '01011011010',
  '11000000011'
];
const OCTO_A = [
  '00111111100',
  '01111111110',
  '11111111111',
  '11100100111',
  '11111111111',
  '00011011000',
  '00110001100',
  '01100000110'
];
const OCTO_B = [
  '00111111100',
  '01111111110',
  '11111111111',
  '11100100111',
  '11111111111',
  '00011011000',
  '00100100100',
  '00011011000'
];

type InvaderType = 'squid' | 'crab' | 'octopus';

const SPRITES: Record<InvaderType, [string[], string[]]> = {
  squid: [SQUID_A, SQUID_B],
  crab: [CRAB_A, CRAB_B],
  octopus: [OCTO_A, OCTO_B]
};
const TYPE_HUE: Record<InvaderType, number> = { squid: 190, crab: 258, octopus: 322 };
const TYPE_POINTS: Record<InvaderType, number> = { squid: 40, crab: 25, octopus: 15 };

const rowType = (row: number): InvaderType => (row === 0 ? 'squid' : row < 3 ? 'crab' : 'octopus');

const CELL = 3;
const SPRITE_W = 11 * CELL;
const SPRITE_H = 8 * CELL;
const PLAYER_W = 32;
const PLAYER_H = 16;
const MARGIN = 16;

type Invader = { x: number; y: number; alive: boolean; hue: number; kind: InvaderType; points: number };
type Bomb = { x: number; y: number; vx: number; vy: number; kind: InvaderType };
type Bullet = { x: number; y: number; vx: number };
type PowerKind = 'rapid' | 'spread' | 'shield' | 'life';
type Power = { x: number; y: number; kind: PowerKind };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Floater = { x: number; y: number; text: string; life: number };
type Star = { x: number; y: number; r: number; spd: number };
type BunkerCell = { x: number; y: number; alive: boolean };

const BUNKER_CELL = 6;

const POWER_COLORS: Record<PowerKind, string> = {
  rapid: '#fbbf24',
  spread: '#34d399',
  shield: '#60a5fa',
  life: '#f472b6'
};
const POWER_LETTER: Record<PowerKind, string> = { rapid: 'R', spread: 'S', shield: '◇', life: '+' };
const POWER_KINDS: PowerKind[] = ['rapid', 'spread', 'shield', 'rapid', 'spread', 'life'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const useSpaceInvaders = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => {
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
    const invaders: Invader[] = [];
    const bullets: Bullet[] = [];
    const bombs: Bomb[] = [];
    const powers: Power[] = [];
    const floaters: Floater[] = [];
    const bunkers: BunkerCell[] = [];
    const particles: Particle[] = [];
    const pointer = { x: 0, active: false, lastMove: 0 };
    const player = { x: 0, y: 0 };
    const state = { score: 0, level: 1, lives: 3, hits: 0, best: 0 };

    let dir = 1;
    let speed = 0.6;
    let marchFrame = 0;
    let lastMarch = 0;
    let lastFire = 0;
    let rapidUntil = 0;
    let spreadUntil = 0;
    let invulnUntil = 0;
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

    const buildWave = () => {
      invaders.length = 0;
      bombs.length = 0;
      powers.length = 0;
      const cols = Math.max(6, Math.min(11, Math.floor(width / 58)));
      const rows = 5;
      const gapX = SPRITE_W + 22;
      const gapY = SPRITE_H + 16;
      const formationW = cols * gapX - 22;
      const startX = Math.max(MARGIN + 6, (width - formationW) / 2);
      const startY = 140;
      for (let r = 0; r < rows; r += 1) {
        const kind = rowType(r);
        for (let c = 0; c < cols; c += 1) {
          invaders.push({
            x: startX + c * gapX,
            y: startY + r * gapY,
            alive: true,
            hue: TYPE_HUE[kind],
            kind,
            points: TYPE_POINTS[kind]
          });
        }
      }

      dir = 1;
      // Gradual ramp: a gentle opening wave that speeds up a little each level.
      speed = 0.18 + state.level * 0.04;
      marchFrame = 0;
      buildBunkers();
    };

    // Four destructible bunkers above the player — classic Invaders cover. Built as a grid of small cells with an
    // arch notch; every hit (enemy bomb or your own fire) erodes a cluster of cells.
    const buildBunkers = () => {
      bunkers.length = 0;
      const count = 4;
      const cols = 9;
      const rows = 5;
      const bw = cols * BUNKER_CELL;
      const spacing = (width - count * bw) / (count + 1);
      const by = player.y - 94;
      for (let b = 0; b < count; b += 1) {
        const bx = spacing + b * (bw + spacing);
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            if (r >= rows - 2 && c >= 3 && c <= 5) {
              continue;
            }

            bunkers.push({ x: bx + c * BUNKER_CELL, y: by + r * BUNKER_CELL, alive: true });
          }
        }
      }
    };

    // Player fire is blocked by a bunker (no pass-through) but doesn't erode it — the cannon fires too fast, it would
    // shred its own cover in seconds. Only enemy bombs erode the bunkers.
    const bunkerBlocks = (x: number, y: number): boolean =>
      bunkers.some(c => c.alive && x >= c.x && x <= c.x + BUNKER_CELL && y >= c.y && y <= c.y + BUNKER_CELL);

    const damageBunker = (x: number, y: number): boolean => {
      for (const cell of bunkers) {
        if (cell.alive && x >= cell.x && x <= cell.x + BUNKER_CELL && y >= cell.y && y <= cell.y + BUNKER_CELL) {
          for (const other of bunkers) {
            if (
              other.alive &&
              Math.abs(other.x - cell.x) <= BUNKER_CELL &&
              Math.abs(other.y - cell.y) <= BUNKER_CELL
            ) {
              other.alive = false;
            }
          }

          return true;
        }
      }

      return false;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      player.y = height - 44;
      player.x = player.x || width / 2;
      seedStars();
      if (!invaders.length) {
        buildWave();
      }
    };

    const burst = (x: number, y: number, hue: number, n: number) => {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2);
        const s = rand(0.6, 3.2);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const addFloater = (x: number, y: number, text: string) => {
      floaters.push({ x, y, text, life: 1 });
    };

    const aliveInvaders = () => invaders.filter(i => i.alive);

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
      burst(player.x, player.y, 280, 22);
      burst(player.x, player.y, 30, 22);
      if (state.lives <= 0) {
        resetGame();

        return;
      }

      publish({ lives: state.lives });
      // Explosion, then a 3-2-1 countdown during which the swarm freezes, then respawn with brief invulnerability.
      const now = performance.now();
      respawnAt = now + 3000;
      invulnUntil = respawnAt + 1500;
      player.x = width / 2;
    };

    const update = (now: number) => {
      if (isPaused()) {
        return;
      }

      // Frozen during the respawn countdown — the swarm and its bombs hold while the player waits to re-enter.
      if (now < respawnAt) {
        return;
      }

      const alive = aliveInvaders();
      if (!alive.length) {
        state.level += 1;
        publish({ level: state.level });
        buildWave();

        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      for (const inv of alive) {
        minX = Math.min(minX, inv.x);
        maxX = Math.max(maxX, inv.x + SPRITE_W);
      }

      // Autopilot until the visitor takes over. Stable by design: hover under the nearest column (no row-to-row target
      // jumps), dodge only the single nearest incoming bomb, and ignore sub-pixel corrections — that combination is
      // what removes the left-right flicker.
      const ax = keyAxisX();
      const autopilot = ax === 0 && (!pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS));
      if (ax !== 0) {
        // Keyboard (←/→ or A/D) moves the cannon directly.
        player.x += ax * 6;
      } else if (autopilot) {
        let threat: Bomb | undefined;
        let threatDist = Infinity;
        for (const bomb of bombs) {
          const dx = Math.abs(bomb.x - player.x);
          if (dx < 56 && bomb.y > player.y - 240 && bomb.y < player.y) {
            const d = player.y - bomb.y;
            if (d < threatDist) {
              threatDist = d;
              threat = bomb;
            }
          }
        }

        let target: number;
        if (threat) {
          target = threat.x < player.x ? player.x + 120 : player.x - 120;
        } else {
          let coin: Power | undefined;
          for (const power of powers) {
            if (!coin || power.y > coin.y) {
              coin = power;
            }
          }

          if (coin && coin.y > height * 0.4) {
            target = coin.x;
          } else {
            let near = alive[0];
            for (const inv of alive) {
              if (Math.abs(inv.x + SPRITE_W / 2 - player.x) < Math.abs(near.x + SPRITE_W / 2 - player.x)) {
                near = inv;
              }
            }

            // Lead the shot: the bullet flies straight up at BULLET_SPEED, so by the time it reaches the swarm's row the
            // target has marched sideways. Aim where it WILL be — flight time × the swarm's horizontal velocity.
            const stepRamp = speed * (1 + (1 - alive.length / invaders.length) * 1.0);
            const flightFrames = Math.max(0, (player.y - near.y) / BULLET_SPEED);
            target = near.x + SPRITE_W / 2 + dir * stepRamp * flightFrames;
          }
        }

        if (Math.abs(target - player.x) > 6) {
          player.x += (target - player.x) * 0.1;
        }
      } else {
        player.x += (pointer.x - player.x) * 0.24;
      }

      player.x = Math.max(PLAYER_W, Math.min(width - PLAYER_W, player.x));

      // Continuous leg animation: toggle on a cadence that quickens as the swarm thins and levels climb, so it keeps
      // marching the whole way across — not only at the walls.
      const marchInterval = Math.max(130, 440 - state.level * 24 - (1 - alive.length / invaders.length) * 220);
      if (now - lastMarch > marchInterval) {
        marchFrame ^= 1;
        lastMarch = now;
      }

      // Formation march — flip only when the NEXT step in the current direction would cross a wall, so the swarm never
      // overshoots off-screen.
      const ramp = speed * (1 + (1 - alive.length / invaders.length) * 1.0);
      const hitsWall = (dir > 0 && maxX + ramp > width - MARGIN) || (dir < 0 && minX - ramp < MARGIN);
      if (hitsWall) {
        dir *= -1;
        let breached = false;
        for (const inv of invaders) {
          inv.y += 16;
          if (inv.alive && inv.y + SPRITE_H >= player.y - 6) {
            breached = true;
          }
        }

        if (breached) {
          loseLife();
          buildWave();
        }
      } else {
        for (const inv of alive) {
          inv.x += dir * ramp;
        }
      }

      // Power-ups bend the cannon: rapid fire shortens the interval, spread fires a 3-way volley.
      const rapid = now < rapidUntil;
      const spread = now < spreadUntil;
      const interval = rapid ? 90 : Math.max(150, 320 - state.level * 14);
      if (now - lastFire > interval) {
        if (spread) {
          bullets.push({ x: player.x, y: player.y - 10, vx: -2.4 });
          bullets.push({ x: player.x, y: player.y - 10, vx: 0 });
          bullets.push({ x: player.x, y: player.y - 10, vx: 2.4 });
        } else {
          bullets.push({ x: player.x, y: player.y - 10, vx: 0 });
        }

        sfx.shoot();
        lastFire = now;
      }

      // Each species attacks differently: squids fire often, fast and aimed; crabs straight; octopuses rarely but
      // slow and heavy.
      if (bombs.length < 5 && Math.random() < 0.03 + state.level * 0.004) {
        const shooter = alive[Math.floor(rand(0, alive.length))];
        const fireChance = shooter.kind === 'squid' ? 1 : shooter.kind === 'crab' ? 0.6 : 0.4;
        if (Math.random() < fireChance) {
          const bx = shooter.x + SPRITE_W / 2;
          const by = shooter.y + SPRITE_H;
          if (shooter.kind === 'squid') {
            // Aimed at the player with a little spread — threatening, but not perfect, so you can dodge.
            const speed = 3.6 + state.level * 0.12;
            const a = Math.atan2(player.y - by, player.x - bx) + rand(-0.13, 0.13);
            bombs.push({ x: bx, y: by, vx: Math.cos(a) * speed, vy: Math.max(2, Math.sin(a) * speed), kind: 'squid' });
          } else if (shooter.kind === 'crab') {
            // Crabs sometimes take a loose aim, otherwise fire straight.
            if (Math.random() < 0.4) {
              const a = Math.atan2(player.y - by, player.x - bx) + rand(-0.3, 0.3);
              bombs.push({ x: bx, y: by, vx: Math.cos(a) * 3, vy: Math.max(2, Math.sin(a) * 3), kind: 'crab' });
            } else {
              bombs.push({ x: bx, y: by, vx: 0, vy: 3.1, kind: 'crab' });
            }
          } else {
            bombs.push({ x: bx, y: by, vx: 0, vy: 2.3, kind: 'octopus' });
          }
        }
      }

      // Falling power-ups: caught at the player's row, they grant a timed boost or an extra life.
      for (let p = powers.length - 1; p >= 0; p -= 1) {
        const power = powers[p];
        power.y += 2.4;
        if (power.y > height) {
          powers.splice(p, 1);
          continue;
        }

        if (power.y > player.y - PLAYER_H * 1.6 && Math.abs(power.x - player.x) < PLAYER_W * 1.05) {
          powers.splice(p, 1);
          if (power.kind === 'rapid') {
            rapidUntil = now + 6500;
          } else if (power.kind === 'spread') {
            spreadUntil = now + 6500;
          } else if (power.kind === 'shield') {
            invulnUntil = now + 5000;
          } else {
            state.lives = Math.min(5, state.lives + 1);
            publish({ lives: state.lives });
          }

          sfx.power();
          burst(power.x, power.y, 50, 16);
        }
      }

      for (let b = bullets.length - 1; b >= 0; b -= 1) {
        const bullet = bullets[b];
        bullet.y -= BULLET_SPEED;
        bullet.x += bullet.vx;
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > width) {
          bullets.splice(b, 1);
          continue;
        }

        if (bunkerBlocks(bullet.x, bullet.y)) {
          bullets.splice(b, 1);
          continue;
        }

        for (const inv of alive) {
          if (
            inv.alive &&
            bullet.x > inv.x &&
            bullet.x < inv.x + SPRITE_W &&
            bullet.y > inv.y &&
            bullet.y < inv.y + SPRITE_H
          ) {
            inv.alive = false;
            bullets.splice(b, 1);
            const gain = inv.points * state.level;
            state.score += gain;
            state.hits += 1;
            state.best = Math.max(state.best, state.score);
            burst(inv.x + SPRITE_W / 2, inv.y + SPRITE_H / 2, inv.hue, 14);
            addFloater(inv.x + SPRITE_W / 2, inv.y, `+${gain}`);
            sfx.hit();
            publish({ score: state.score, hits: state.hits, best: state.best });
            if (powers.length < 2 && Math.random() < 0.16) {
              powers.push({
                x: inv.x + SPRITE_W / 2,
                y: inv.y + SPRITE_H / 2,
                kind: POWER_KINDS[Math.floor(rand(0, POWER_KINDS.length))]
              });
            }

            break;
          }
        }
      }

      const invulnerable = now < invulnUntil;
      for (let b = bombs.length - 1; b >= 0; b -= 1) {
        const bomb = bombs[b];
        bomb.x += bomb.vx;
        bomb.y += bomb.vy;
        if (bomb.y > height || bomb.x < 0 || bomb.x > width) {
          bombs.splice(b, 1);
          continue;
        }

        if (damageBunker(bomb.x, bomb.y)) {
          bombs.splice(b, 1);
          continue;
        }

        if (
          !invulnerable &&
          bomb.x > player.x - PLAYER_W / 2 &&
          bomb.x < player.x + PLAYER_W / 2 &&
          bomb.y > player.y - PLAYER_H / 2
        ) {
          bombs.splice(b, 1);
          loseLife();
        }
      }
    };

    const drawSprite = (rows: string[], x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r];
        for (let c = 0; c < row.length; c += 1) {
          if (row[c] === '1') {
            ctx.fillRect(x + c * CELL, y + r * CELL, CELL, CELL);
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

      // Physics steps every tick so motion speed is identical in 30/60fps mode; only the (expensive) rendering is
      // throttled in low-performance mode.
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
      for (const inv of invaders) {
        if (!inv.alive) {
          continue;
        }

        const color = `hsl(${inv.hue}, 85%, 72%)`;
        ctx.shadowColor = color;
        drawSprite(SPRITES[inv.kind][marchFrame], inv.x, inv.y, color);
      }

      // Bunkers.
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#4ade80';
      for (const cell of bunkers) {
        if (cell.alive) {
          ctx.fillRect(cell.x, cell.y, BUNKER_CELL, BUNKER_CELL);
        }
      }

      ctx.shadowBlur = 8;
      ctx.shadowColor = '#c4b5fd';
      ctx.fillStyle = '#ddd6fe';
      for (const bullet of bullets) {
        ctx.fillRect(bullet.x - 1.5, bullet.y, 3, 12);
      }

      for (const bomb of bombs) {
        const color = bomb.kind === 'squid' ? '#67e8f9' : bomb.kind === 'octopus' ? '#f0abfc' : '#fca5a5';
        const w = bomb.kind === 'octopus' ? 5 : bomb.kind === 'squid' ? 2 : 3;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.fillRect(bomb.x - w / 2, bomb.y, w, bomb.kind === 'octopus' ? 12 : 10);
      }

      // Falling power-ups: a glowing coin with a glyph.
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
        ctx.translate(player.x, player.y);
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 12;
        const hull = ctx.createLinearGradient(0, -PLAYER_H - 8, 0, 2);
        hull.addColorStop(0, '#ede9fe');
        hull.addColorStop(1, '#6d28d9');
        ctx.fillStyle = hull;
        ctx.beginPath();
        ctx.moveTo(-PLAYER_W / 2, 2);
        ctx.lineTo(-PLAYER_W / 2 + 5, -7);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-2.5, -PLAYER_H - 7);
        ctx.lineTo(2.5, -PLAYER_H - 7);
        ctx.lineTo(6, -8);
        ctx.lineTo(PLAYER_W / 2 - 5, -7);
        ctx.lineTo(PLAYER_W / 2, 2);
        ctx.closePath();
        ctx.fill();
        // cockpit dome
        ctx.fillStyle = '#f5f3ff';
        ctx.beginPath();
        ctx.arc(0, -9, 3, Math.PI, 0);
        ctx.fill();
        // engine pods
        ctx.fillStyle = 'rgba(196, 181, 253, 0.7)';
        ctx.fillRect(-PLAYER_W / 2 + 3, -1, 5, 4);
        ctx.fillRect(PLAYER_W / 2 - 8, -1, 5, 4);
        ctx.restore();
      }

      // Shield bubble while invulnerable (but not during the respawn countdown — the ship isn't there yet).
      if (!reviving && now < invulnUntil) {
        ctx.shadowColor = '#60a5fa';
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.4 + Math.sin(now / 120) * 0.2})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(player.x, player.y - PLAYER_H / 2, PLAYER_W * 0.8, 0, Math.PI * 2);
        ctx.stroke();
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

      // Respawn countdown overlay.
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
        ctx.fillText('REENTRY', width / 2, height / 2 + 46);
        ctx.restore();
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    };

    // Pointer events on the canvas only: moving off the play area (onto the logs/copy) fires `pointerleave`, so the
    // autopilot takes back over there.
    const onMove = (e: PointerEvent) => {
      resumeAudio();
      const rect = canvas.getBoundingClientRect();
      pointer.x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
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

export default useSpaceInvaders;
