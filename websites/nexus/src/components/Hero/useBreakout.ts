import { type RefObject, useEffect } from 'react';

import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { getGameContext, sizeCanvas } from './heroCanvas';
import { keyAxisX } from './heroKeys';
import { isPaused } from './heroPause';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';
import { isHeroVisible } from './heroVisibility';

type Brick = { x: number; y: number; w: number; h: number; alive: boolean; hue: number };
type Ball = { x: number; y: number; vx: number; vy: number };
type PowerKind = 'wide' | 'slow' | 'multi' | 'life';
type Power = { x: number; y: number; kind: PowerKind };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Floater = { x: number; y: number; text: string; life: number };
type Star = { x: number; y: number; r: number; spd: number };

const PADDLE_W = 96;
const PADDLE_H = 12;
const BALL_R = 6;
const POWER_COLORS: Record<PowerKind, string> = {
  wide: '#34d399',
  slow: '#60a5fa',
  multi: '#fbbf24',
  life: '#f472b6'
};
const POWER_LETTER: Record<PowerKind, string> = { wide: 'W', slow: 'S', multi: '3', life: '+' };
const POWER_KINDS: PowerKind[] = ['wide', 'slow', 'multi', 'wide', 'multi', 'slow', 'life'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const useBreakout = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = getGameContext(canvas);
    if (!ctx) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;

    const stars: Star[] = [];
    const bricks: Brick[] = [];
    const powers: Power[] = [];
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
    const pointer = { x: 0, active: false, lastMove: 0 };
    const paddle = { x: 0, y: 0 };
    const balls: Ball[] = [];
    const state = { score: 0, level: 1, lives: 3, hits: 0, best: 0 };
    let raf = 0;
    let shake = 0;
    let lastFrame = 0;
    let wideUntil = 0;

    const paddleWidth = (now: number) => (now < wideUntil ? PADDLE_W * 1.6 : PADDLE_W);

    const seedStars = () => {
      stars.length = 0;
      const count = Math.round(Math.min(140, (width * height) / 9000));
      for (let i = 0; i < count; i += 1) {
        stars.push({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), spd: rand(0.08, 0.5) });
      }
    };

    const launchBall = () => {
      balls.length = 0;
      // Gentle opening speed with a soft per-level ramp, so early levels stay comfortable.
      const sp = 3.4 + state.level * 0.25;
      balls.push({ x: paddle.x, y: paddle.y - 18, vx: rand(-1, 1) * sp * 0.5, vy: -sp });
    };

    const buildLevel = () => {
      bricks.length = 0;
      const cols = Math.max(6, Math.min(14, Math.floor((width - 80) / 60)));
      const rows = 5;
      const gap = 8;
      const brickW = (width - 80 - gap * (cols - 1)) / cols;
      const brickH = 16;
      const startX = 40;
      const startY = 130;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          bricks.push({
            x: startX + c * (brickW + gap),
            y: startY + r * (brickH + gap),
            w: brickW,
            h: brickH,
            alive: true,
            hue: 248 + r * 8
          });
        }
      }

      launchBall();
    };

    const resize = () => {
      const size = sizeCanvas(canvas, ctx);
      width = size.width;
      height = size.height;
      paddle.y = height - 40;
      paddle.x = paddle.x || width / 2;
      seedStars();
      if (!bricks.length) {
        buildLevel();
      }
    };

    const burst = (x: number, y: number, hue: number, n: number) => {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2);
        const s = rand(0.6, 3);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const resetGame = () => {
      state.best = Math.max(state.best, state.score);
      state.score = 0;
      state.level = 1;
      state.lives = 3;
      publish({ best: state.best, score: 0, level: 1, lives: 3 });
      buildLevel();
    };

    const spawnMulti = () => {
      // Split each live ball into a small fan — the multiball power-up.
      const seeds = balls.slice(0, 3);
      for (const seed of seeds) {
        if (balls.length >= 6) {
          break;
        }

        const sp = Math.max(3.4, Math.hypot(seed.vx, seed.vy));
        for (const a of [-0.5, 0.5]) {
          if (balls.length >= 6) {
            break;
          }

          balls.push({
            x: seed.x,
            y: seed.y,
            vx: Math.sin(a) * sp + seed.vx * 0.4,
            vy: -Math.abs(Math.cos(a) * sp)
          });
        }
      }
    };

    const update = (now: number) => {
      if (isPaused()) {
        return;
      }

      const alive = bricks.filter(b => b.alive);
      if (!alive.length) {
        state.level += 1;
        publish({ level: state.level });
        buildLevel();

        return;
      }

      const pw = paddleWidth(now);

      // Autopilot tracks the lowest descending ball (the most urgent one) with a touch of lag; the cursor takes over
      // instantly.
      const autopilot = !pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS);
      let chase = balls[0];
      for (const b of balls) {
        if (b.vy > 0 && (!chase || b.y > chase.y)) {
          chase = b;
        }
      }

      const ax = keyAxisX();
      if (ax !== 0) {
        // Keyboard (←/→ or A/D) drives the paddle directly.
        paddle.x += ax * 9;
      } else {
        const target = autopilot ? (chase?.x ?? paddle.x) : pointer.x;
        paddle.x += (target - paddle.x) * (autopilot ? 0.1 : 0.25);
      }

      paddle.x = Math.max(pw / 2, Math.min(width - pw / 2, paddle.x));

      for (let i = balls.length - 1; i >= 0; i -= 1) {
        const ball = balls[i];
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x < BALL_R || ball.x > width - BALL_R) {
          ball.vx *= -1;
          ball.x = Math.max(BALL_R, Math.min(width - BALL_R, ball.x));
        }

        if (ball.y < BALL_R) {
          ball.vy *= -1;
          ball.y = BALL_R;
        }

        if (
          ball.vy > 0 &&
          ball.y + BALL_R > paddle.y &&
          ball.y < paddle.y + PADDLE_H &&
          ball.x > paddle.x - pw / 2 &&
          ball.x < paddle.x + pw / 2
        ) {
          const offset = (ball.x - paddle.x) / (pw / 2);
          const sp = Math.hypot(ball.vx, ball.vy);
          ball.vx = offset * sp * 0.8;
          ball.vy = -Math.abs(Math.sqrt(Math.max(1, sp * sp - ball.vx * ball.vx)));
          ball.y = paddle.y - BALL_R;
          sfx.bounce();
        }

        for (const brick of alive) {
          if (
            ball.x > brick.x &&
            ball.x < brick.x + brick.w &&
            ball.y - BALL_R < brick.y + brick.h &&
            ball.y + BALL_R > brick.y
          ) {
            brick.alive = false;
            ball.vy *= -1;
            const gain = 10 * state.level;
            state.score += gain;
            state.hits += 1;
            state.best = Math.max(state.best, state.score);
            sfx.hit();
            burst(ball.x, ball.y, brick.hue, 10);
            floaters.push({ x: ball.x, y: ball.y, text: `+${gain}`, life: 1 });
            publish({ score: state.score, hits: state.hits, best: state.best });
            if (powers.length < 2 && Math.random() < 0.14) {
              powers.push({
                x: brick.x + brick.w / 2,
                y: brick.y,
                kind: POWER_KINDS[Math.floor(rand(0, POWER_KINDS.length))]
              });
            }

            break;
          }
        }

        if (ball.y > height + 20) {
          balls.splice(i, 1);
        }
      }

      // Falling power-ups, caught on the paddle.
      for (let p = powers.length - 1; p >= 0; p -= 1) {
        const power = powers[p];
        power.y += 2.6;
        if (power.y > height) {
          powers.splice(p, 1);
          continue;
        }

        if (power.y > paddle.y - 8 && Math.abs(power.x - paddle.x) < pw / 2 + 8) {
          powers.splice(p, 1);
          if (power.kind === 'wide') {
            wideUntil = now + 8000;
          } else if (power.kind === 'slow') {
            for (const ball of balls) {
              ball.vx *= 0.62;
              ball.vy *= 0.62;
            }
          } else if (power.kind === 'multi') {
            spawnMulti();
          } else {
            state.lives = Math.min(5, state.lives + 1);
            publish({ lives: state.lives });
          }

          sfx.power();
          burst(power.x, power.y, 50, 14);
        }
      }

      // A life is only lost when the last ball drains off the bottom.
      if (!balls.length) {
        state.lives -= 1;
        shake = 12;
        sfx.hurt();
        if (state.lives <= 0) {
          resetGame();

          return;
        }

        publish({ lives: state.lives });
        launchBall();
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
      for (const brick of bricks) {
        if (!brick.alive) {
          continue;
        }

        const color = `hsl(${brick.hue}, 80%, 66%)`;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }

      const pw = paddleWidth(now);
      ctx.shadowColor = '#a78bfa';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(paddle.x - pw / 2, paddle.y, pw, PADDLE_H);

      ctx.shadowColor = '#ede9fe';
      ctx.fillStyle = '#fff';
      for (const ball of balls) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // Falling power-ups.
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
    };

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

export default useBreakout;
